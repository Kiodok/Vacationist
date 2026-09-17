#!/usr/bin/env node
/**
 * Growth Plan Q4 2026, Phase 2 — "harvest social proof". Lists real users who have hit a
 * genuine success moment (a completed trip, or a settled expense) so the founder can send a
 * direct, personal review ask instead of guessing who to message. Read-only — no writes.
 *
 * Excludes: the auto-seeded example trip (trips.is_example), guest accounts (users.is_guest,
 * no store account to review from), and anyone without an email on file. Flags users who
 * already received the in-app `review_nudge` notification so you don't double-ask.
 *
 * Modelled on scripts/analytics-report.mjs — same .env.production / service-role-key setup,
 * same gitignored analytics-reports/ output directory.
 *
 * Run:      node scripts/review-outreach.mjs
 * Output:   analytics-reports/review-outreach.html (gitignored — overwritten each run), opened
 *           automatically in your default browser.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');

try {
  process.loadEnvFile(resolve(ROOT, '.env.production'));
} catch {
  console.error('Missing .env.production at repo root. Copy .env.production.example and fill it in.');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.production.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function fetchAll(table, select, filterFn) {
  const PAGE_SIZE = 1000;
  let rows = [];
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) {
      console.error(`Query on ${table} failed:`, error.message);
      process.exit(1);
    }
    rows = rows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Fetch
// ─────────────────────────────────────────────────────────────────────────

console.log('Fetching real (non-example, non-deleted) trips …');
const trips = await fetchAll('trips', 'id, title, end_date', (q) =>
  q.eq('is_example', false).is('deleted_at', null),
);
const tripById = new Map(trips.map((t) => [t.id, t]));
const tripIds = trips.map((t) => t.id);

console.log('Fetching trip members …');
const members = tripIds.length
  ? await fetchAll('trip_members', 'trip_id, user_id, role', (q) => q.in('trip_id', tripIds))
  : [];

console.log('Fetching non-guest users with an email on file …');
const users = await fetchAll('users', 'id, name, email, locale', (q) =>
  q.eq('is_guest', false).not('email', 'is', null),
);
const userById = new Map(users.map((u) => [u.id, u]));

console.log('Fetching settled expense splits …');
const expenses = tripIds.length
  ? await fetchAll('expenses', 'id, trip_id, created_at', (q) => q.in('trip_id', tripIds).is('archived_at', null))
  : [];
const tripIdByExpenseId = new Map(expenses.map((e) => [e.id, e.trip_id]));
const expenseIds = expenses.map((e) => e.id);
const settledSplits = expenseIds.length
  ? await fetchAll('expense_splits', 'expense_id, user_id, status', (q) =>
      q.in('expense_id', expenseIds).eq('status', 'settled'),
    )
  : [];
const expenseCreatedAt = new Map(expenses.map((e) => [e.id, e.created_at]));

console.log('Fetching existing review_nudge notifications …');
const nudged = await fetchAll('notifications', 'user_id', (q) => q.eq('related_type', 'review_nudge'));
const alreadyNudged = new Set(nudged.map((n) => n.user_id));

// ─────────────────────────────────────────────────────────────────────────
// 2. Build one "best success moment" candidate row per real user
// ─────────────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
const membersByUser = new Map();
for (const m of members) {
  if (!membersByUser.has(m.user_id)) membersByUser.set(m.user_id, []);
  membersByUser.get(m.user_id).push(m);
}

const candidates = new Map(); // user_id -> { user, moments: [{type, date, tripTitle}], tripCount }

function addMoment(userId, moment) {
  const user = userById.get(userId);
  if (!user) return; // guest or no email — excluded
  if (!candidates.has(userId)) candidates.set(userId, { user, moments: [] });
  candidates.get(userId).moments.push(moment);
}

for (const m of members) {
  const trip = tripById.get(m.trip_id);
  if (trip && trip.end_date && trip.end_date < today) {
    addMoment(m.user_id, { type: 'Trip completed', date: trip.end_date, tripTitle: trip.title });
  }
}

for (const split of settledSplits) {
  const tripId = tripIdByExpenseId.get(split.expense_id);
  const trip = tripById.get(tripId);
  if (!trip) continue;
  const date = (expenseCreatedAt.get(split.expense_id) || '').slice(0, 10);
  addMoment(split.user_id, { type: 'Expense settled', date, tripTitle: trip.title });
}

const rows = [...candidates.values()]
  .map(({ user, moments }) => {
    const best = moments.reduce((a, b) => (b.date > a.date ? b : a));
    const tripCount = (membersByUser.get(user.id) || []).length;
    return {
      name: user.name,
      email: user.email,
      locale: user.locale || '',
      momentType: best.type,
      momentDate: best.date,
      tripTitle: best.tripTitle,
      tripCount,
      alreadyNudged: alreadyNudged.has(user.id),
    };
  })
  .sort((a, b) => (b.momentDate > a.momentDate ? 1 : b.momentDate < a.momentDate ? -1 : 0));

console.log(`${rows.length} outreach candidate(s) found (${rows.filter((r) => !r.alreadyNudged).length} not yet nudged by the app).`);

// ─────────────────────────────────────────────────────────────────────────
// 3. Render — a plain table + copy-paste ask templates. No charts needed for this one.
// ─────────────────────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function rowsTable(rows) {
  if (rows.length === 0) {
    return '<p class="empty">No real users have hit a completed-trip or settled-expense moment yet.</p>';
  }
  const body = rows
    .map(
      (r) => `<tr${r.alreadyNudged ? ' class="nudged"' : ''}>
        <td>${esc(r.name)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.locale)}</td>
        <td>${esc(r.momentType)}</td>
        <td>${esc(r.momentDate)}</td>
        <td>${esc(r.tripTitle)}</td>
        <td class="num">${r.tripCount}</td>
        <td>${r.alreadyNudged ? 'Already app-nudged' : ''}</td>
      </tr>`,
    )
    .join('');
  return `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Locale</th><th>Moment</th><th>Date</th><th>Trip</th><th class="num"># trips</th><th>Note</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vacationist — Review Outreach</title>
<style>
  :root {
    color-scheme: light;
    --surface-1: #fcfcfb; --page: #f9f9f7;
    --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #898781;
    --gridline: #e1e0d9; --border: rgba(11,11,11,0.10); --nudged: #fff4e0;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-1: #1a1a19; --page: #0d0d0d;
      --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #898781;
      --gridline: #2c2c2a; --border: rgba(255,255,255,0.10); --nudged: #2a2410;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page); color: var(--text-primary);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 2rem 1.5rem 4rem;
  }
  main { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  .subtitle { color: var(--text-secondary); margin: 0 0 2rem; font-size: 0.9rem; }
  .card {
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    padding: 1.5rem; margin-bottom: 1.5rem;
  }
  .card h2 { font-size: 1rem; margin: 0 0 1rem; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .data-table th, .data-table td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--gridline); }
  .data-table th { color: var(--text-secondary); font-weight: 600; }
  .data-table tr.nudged { background: var(--nudged); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: var(--text-muted); font-style: italic; }
  .footnote { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.75rem; }
  pre { white-space: pre-wrap; background: var(--page); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; font-size: 0.85rem; }
</style>
</head>
<body>
<main>
  <h1>Vacationist — Review Outreach</h1>
  <p class="subtitle">Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${SUPABASE_URL.includes('fsfsqghbejwvgxujoyne') ? 'prod' : 'dev'} · sorted by most recent success moment</p>

  <div class="card">
    <h2>Candidates (${rows.length})</h2>
    ${rowsTable(rows)}
    <p class="footnote">Rows shaded and marked "Already app-nudged" already received the in-app <code>review_nudge</code> notification for some trip — a personal ask is still fine, but don't be surprised if they've already seen the native prompt. Excludes the demo trip and guest accounts. Target: 25+ real reviews across both stores before adding <code>aggregateRating</code> JSON-LD (marketing/seo-strategy.md Pillar 4).</p>
  </div>

  <div class="card">
    <h2>Ask template — EN</h2>
    <pre>Hey {{name}} — thanks for planning {{tripTitle}} with Vacationist! If it saved you some group-chat chaos, a quick rating on the App Store or Play Store would really help other travelers find it. Takes 30 seconds: [store link]. Thank you! 🙏</pre>
  </div>

  <div class="card">
    <h2>Ask template — DE</h2>
    <pre>Hallo {{name}} — danke, dass ihr {{tripTitle}} mit Vacationist geplant habt! Wenn euch die App die Gruppenchat-Chaos erspart hat, würde uns eine kurze Bewertung im App Store oder Play Store riesig helfen, damit mehr Reisegruppen die App finden. Dauert 30 Sekunden: [Store-Link]. Danke euch! 🙏</pre>
  </div>
</main>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────
// 4. Write + open
// ─────────────────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, 'analytics-reports');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'review-outreach.html');
writeFileSync(outFile, html, 'utf8');
console.log(`Written: ${outFile}`);

const opener = process.platform === 'win32' ? `start "" "${outFile}"` : process.platform === 'darwin' ? `open "${outFile}"` : `xdg-open "${outFile}"`;
exec(opener, (err) => {
  if (err) console.log('Could not auto-open the report — open it manually:', outFile);
});
