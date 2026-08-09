import { createClient } from 'jsr:@supabase/supabase-js@2';

// Primary source: free, no-API-key, no-rate-limit, ECB-sourced. See engineering/supabase.md
// for the verification that landed this choice (Phase 15, multi-currency support). Rates are
// always EUR-relative; /latest?base=EUR omits EUR itself (it's the base), so EUR=1 is
// inserted explicitly below rather than relying on the response to include it.
const FRANKFURTER_LATEST_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';
const FRANKFURTER_CURRENCIES_URL = 'https://api.frankfurter.dev/v1/currencies';

// Secondary source (Phase 15b): fills in currencies Frankfurter/ECB doesn't price at all
// (Balkans, Eastern Europe, Caucasus) — verified live to cover all 12 gap currencies,
// including the ones least likely to be tracked (BYN, AZN, GEL, AMD). Free, no API key,
// once-daily usage is explicitly within their free-tier terms (matches our cadence exactly).
// Frankfurter always wins when both sources price a currency — this is a gap-filler only,
// never a replacement for the primary source, so none of the 13 already-working currencies
// change provenance or risk an unexplained rate jump between runs.
// Attribution required by their terms: "Rates By Exchange Rate API" — surfaced in the app's
// CurrencyPickerSheet / SettlementsModal footers, not just here.
const EXCHANGERATE_API_URL = 'https://open.er-api.com/v6/latest/EUR';

const RESEND_API_URL = 'https://api.resend.com/emails';

// A currency missing from today's feed only alerts after this many consecutive daily misses
// (the cron runs once/day — see 20260809100008_create_fetch_exchange_rates_cron.sql) to
// avoid alerting on a single transient API hiccup.
const MISSING_GRACE_HOURS = 20;

interface FrankfurterLatest {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface ExchangeRateApiLatest {
  result: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

interface CurrencyCatalogRow {
  code: string;
  is_rate_available: boolean;
  missing_since: string | null;
}

interface DriftEvent {
  currency_code: string;
  change_type: 'lost' | 'gained' | 'new_unknown';
  details: string;
}

interface RateRow {
  currency: string;
  rate: number;
  as_of: string;
  source: 'ecb' | 'exchangerate-api';
}

// Single client reused across all invocations — created once on cold start.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } },
);

// Constant-time string comparison — same helper as push-notification/index.ts, prevents a
// timing oracle on the shared secret.
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Best-effort secondary fetch — a failure here must never take down the primary Frankfurter
// update. Returns null (not a throw) on any failure; the caller just proceeds without it.
async function fetchExchangeRateApi(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(EXCHANGERATE_API_URL);
    if (!res.ok) {
      console.error('ExchangeRate-API request failed', res.status);
      return null;
    }
    const data = (await res.json()) as ExchangeRateApiLatest;
    if (data.result !== 'success' || !data.rates) {
      console.error('ExchangeRate-API returned an unexpected payload', data.result);
      return null;
    }
    return data.rates;
  } catch (err) {
    console.error('ExchangeRate-API fetch threw', err);
    return null;
  }
}

async function sendDriftAlertEmail(events: DriftEvent[]): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const alertEmail = Deno.env.get('FX_ALERT_EMAIL');
  if (!apiKey || !alertEmail || events.length === 0) return;

  const lines = events.map((e) => `- [${e.change_type.toUpperCase()}] ${e.currency_code}: ${e.details}`);
  const html = `
    <h2>Vacationist — currency feed change detected</h2>
    <p>The daily FX rate fetch found ${events.length} change(s):</p>
    <pre>${lines.join('\n')}</pre>
    <p>Check public.currency_catalog / public.currency_drift_alerts for full detail.</p>
  `;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vacationist Alerts <alerts@vacationist.app>',
        to: [alertEmail],
        subject: `Vacationist: ${events.length} currency feed change(s) detected`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('Resend email failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('Resend email threw', err);
  }
}

async function handleFetch(): Promise<Response> {
  const [latestRes, currenciesRes, secondaryRates] = await Promise.all([
    fetch(FRANKFURTER_LATEST_URL),
    fetch(FRANKFURTER_CURRENCIES_URL),
    fetchExchangeRateApi(),
  ]);

  if (!latestRes.ok || !currenciesRes.ok) {
    return jsonResponse({ error: 'Frankfurter API request failed' }, 502);
  }

  const latest = (await latestRes.json()) as FrankfurterLatest;
  const allTrackedCurrencies = (await currenciesRes.json()) as Record<string, string>;

  const { data: catalog, error: catalogErr } = await supabase
    .from('currency_catalog')
    .select('code, is_rate_available, missing_since');

  if (catalogErr) {
    return jsonResponse({ error: catalogErr.message }, 500);
  }

  const trackedCodes = new Set((catalog as CurrencyCatalogRow[]).map((c) => c.code));

  // ── 1. Build today's rate rows — Frankfurter primary, ExchangeRate-API fills gaps only ──
  const frankfurterCodes = new Set<string>(['EUR', ...Object.keys(latest.rates)]);

  const rows: RateRow[] = [
    { currency: 'EUR', rate: 1, as_of: latest.date, source: 'ecb' },
    ...Object.entries(latest.rates).map(
      ([currency, rate]): RateRow => ({ currency, rate, as_of: latest.date, source: 'ecb' }),
    ),
  ];

  if (secondaryRates) {
    for (const [currency, rate] of Object.entries(secondaryRates)) {
      if (frankfurterCodes.has(currency)) continue; // Frankfurter already covers it — skip
      rows.push({ currency, rate, as_of: latest.date, source: 'exchangerate-api' });
    }
  }

  // "Available today" = whatever either source actually returned, restricted to what we track.
  const todaysCodes = new Set<string>(rows.map((r) => r.currency));

  const rowsToInsert = rows.filter((r) => trackedCodes.has(r.currency));

  if (rowsToInsert.length > 0) {
    const { error: upsertErr } = await supabase
      .from('exchange_rates')
      .upsert(rowsToInsert, { onConflict: 'currency,as_of' });
    if (upsertErr) {
      return jsonResponse({ error: upsertErr.message }, 500);
    }
  }

  // ── 2. Drift detection ──────────────────────────────────────────────────────
  const driftEvents: DriftEvent[] = [];
  const nowIso = new Date().toISOString();

  for (const entry of catalog as CurrencyCatalogRow[]) {
    const availableToday = todaysCodes.has(entry.code);

    if (entry.is_rate_available && !availableToday) {
      // Was priced, isn't today.
      if (!entry.missing_since) {
        await supabase
          .from('currency_catalog')
          .update({ missing_since: nowIso })
          .eq('code', entry.code);
        continue; // first miss — grace period, no alert yet
      }
      const missingSinceMs = new Date(entry.missing_since).getTime();
      const hoursMissing = (Date.now() - missingSinceMs) / (1000 * 60 * 60);
      if (hoursMissing >= MISSING_GRACE_HOURS) {
        await supabase
          .from('currency_catalog')
          .update({ is_rate_available: false })
          .eq('code', entry.code);
        driftEvents.push({
          currency_code: entry.code,
          change_type: 'lost',
          details: `No longer priced by either the Frankfurter/ECB or ExchangeRate-API feed as of ${latest.date} (missing since ${entry.missing_since}). Possible real-world cause: currency retirement (e.g. Eurozone accession).`,
        });
      }
    } else if (!entry.is_rate_available && availableToday) {
      // Newly priced.
      const sourceLabel = frankfurterCodes.has(entry.code) ? 'Frankfurter/ECB' : 'ExchangeRate-API';
      await supabase
        .from('currency_catalog')
        .update({ is_rate_available: true, missing_since: null })
        .eq('code', entry.code);
      driftEvents.push({
        currency_code: entry.code,
        change_type: 'gained',
        details: `Now priced by ${sourceLabel} as of ${latest.date}. Auto-conversion and "Show in X" are now available for this currency.`,
      });
    } else if (entry.is_rate_available && availableToday && entry.missing_since) {
      // Was mid-grace-period, reappeared — clear the flag, no alert (never actually lost).
      await supabase
        .from('currency_catalog')
        .update({ missing_since: null })
        .eq('code', entry.code);
    }
  }

  // Currencies Frankfurter tracks that we don't know about at all — informational only,
  // never auto-added (adding a currency to the catalog is a Tech Lead decision). Reported
  // once ever per code, not on every run — Frankfurter's ~200-currency universe includes
  // ~17 major non-European currencies (AUD, JPY, CAD, ...) that are "new" on literally every
  // daily run with no dedup, which would otherwise spam the alert email forever.
  const { data: previouslyReported } = await supabase
    .from('currency_drift_alerts')
    .select('currency_code')
    .eq('change_type', 'new_unknown');
  const alreadyReportedCodes = new Set((previouslyReported ?? []).map((r: { currency_code: string }) => r.currency_code));

  for (const code of Object.keys(allTrackedCurrencies)) {
    if (!trackedCodes.has(code) && !alreadyReportedCodes.has(code)) {
      driftEvents.push({
        currency_code: code,
        change_type: 'new_unknown',
        details: `Frankfurter tracks "${allTrackedCurrencies[code]}" (${code}), which is not in currency_catalog at all. Add it via migration if relevant to Vacationist's supported region.`,
      });
    }
  }

  if (driftEvents.length > 0) {
    await supabase.from('currency_drift_alerts').insert(
      driftEvents.map((e) => ({
        currency_code: e.currency_code,
        change_type: e.change_type,
        details: e.details,
        emailed_at: nowIso,
      })),
    );
    await sendDriftAlertEmail(driftEvents);
  }

  return jsonResponse({
    as_of: latest.date,
    rates_upserted: rowsToInsert.length,
    secondary_source_used: !!secondaryRates,
    drift_events: driftEvents.length,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  const fxSecret = Deno.env.get('FX_RATES_SECRET');
  if (!authHeader || !fxSecret || !constantTimeEqual(authHeader, `Bearer ${fxSecret}`)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    return await handleFetch();
  } catch (err) {
    console.error('fetch-exchange-rates failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
