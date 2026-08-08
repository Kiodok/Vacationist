#!/usr/bin/env node
/**
 * Local funnel dashboard for the Reddit Ads campaign (Phase 14). Reads public.analytics_events
 * with the service-role key and renders a single self-contained HTML report — no server, no
 * external chart library, nothing committed. This is v1: the funnel/segmentation/trend/top-pages
 * views below are expected to be iterated on as real traffic starts flowing.
 *
 * Setup (once): copy .env.production.example to .env.production at the repo root and fill in
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Deliberately a separate file from .env.local
 *   (which stays whatever you use it for locally) — this script only ever reads
 *   .env.production, by design, so pointing it at prod once means never touching it again.
 *   Point it at dev instead if you're testing the pipeline itself. .env.production is
 *   gitignored.
 *
 * Run:      node scripts/analytics-report.mjs [--days=30]
 * Output:   analytics-reports/report.html (gitignored — overwritten each run), opened
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
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.');
  process.exit(1);
}

const daysArg = process.argv.find((a) => a.startsWith('--days='));
const DAYS = daysArg ? Math.max(1, parseInt(daysArg.slice('--days='.length), 10)) : 30;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─────────────────────────────────────────────────────────────────────────
// 1. Fetch
// ─────────────────────────────────────────────────────────────────────────

const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

console.log(`Fetching analytics_events since ${since.toISOString().slice(0, 10)} …`);

const PAGE_SIZE = 1000;
let events = [];
{
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_name, surface, path, rdt_cid, utm_source, utm_campaign, referrer_host, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('Query failed:', error.message);
      process.exit(1);
    }
    events = events.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
}
console.log(`Fetched ${events.length} events.`);

// ─────────────────────────────────────────────────────────────────────────
// 2. Aggregate
// ─────────────────────────────────────────────────────────────────────────

const isClick = (e) => e.event_name === 'play_store_click' || e.event_name === 'web_app_click';

function sourceBucket(e) {
  if (e.rdt_cid) return 'Reddit (paid)';
  if (e.utm_source) return e.utm_source;
  return 'Organic';
}

// Funnel: three ordered stages. A conservative, non-session-linked count — this is not "N
// visitors became M clickers", just "N visit events, M click events" in the window. Session-
// level funnel linking (via visitor_hash) is a reasonable next iteration, not done here.
const funnel = [
  { label: 'Page visit', count: events.filter((e) => e.event_name === 'page_visit').length },
  { label: 'Store / web-app click', count: events.filter(isClick).length },
  { label: 'Sign up', count: events.filter((e) => e.event_name === 'sign_up').length },
];

// Segmentation: cap at 3 named buckets + "Other" (see dataviz skill — never generate a 4th+
// hue; fold the tail instead).
const bucketTotals = new Map();
for (const e of events) {
  const b = sourceBucket(e);
  bucketTotals.set(b, (bucketTotals.get(b) ?? 0) + 1);
}
const topBuckets = [...bucketTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
function foldedBucket(e) {
  const b = sourceBucket(e);
  return topBuckets.includes(b) ? b : 'Other';
}
const segmentation = funnel.map((stage, i) => {
  const stageEvents =
    i === 0 ? events.filter((e) => e.event_name === 'page_visit')
    : i === 1 ? events.filter(isClick)
    : events.filter((e) => e.event_name === 'sign_up');
  const bySource = new Map();
  for (const e of stageEvents) {
    const b = foldedBucket(e);
    bySource.set(b, (bySource.get(b) ?? 0) + 1);
  }
  return { label: stage.label, bySource };
});
const segmentBuckets = [...topBuckets, ...(events.some((e) => !topBuckets.includes(foldedBucket(e))) ? ['Other'] : [])];

// Daily trend: same three stages, one row per day in the window.
const dayKeys = [];
for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
  dayKeys.push(d.toISOString().slice(0, 10));
}
const trend = dayKeys.map((day) => ({
  day,
  visit: events.filter((e) => e.event_name === 'page_visit' && e.created_at.slice(0, 10) === day).length,
  click: events.filter((e) => isClick(e) && e.created_at.slice(0, 10) === day).length,
  signup: events.filter((e) => e.event_name === 'sign_up' && e.created_at.slice(0, 10) === day).length,
}));

// Top landing pages by visit volume (not by conversion — see footer note in the HTML for why).
const pathCounts = new Map();
for (const e of events) {
  if (e.event_name !== 'page_visit' || !e.path) continue;
  pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);
}
const topPages = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

// Top campaigns by sign-ups, falling back to visits when tied. Only events carrying a
// utm_campaign appear here — organic/direct traffic has none and is excluded by design (this
// is a breakdown of tagged-campaign performance, not a funnel — see the segmentation chart
// above for the organic-vs-paid picture).
const campaignStats = new Map();
for (const e of events) {
  if (!e.utm_campaign) continue;
  const s = campaignStats.get(e.utm_campaign) ?? { visits: 0, clicks: 0, signups: 0 };
  if (e.event_name === 'page_visit') s.visits++;
  else if (isClick(e)) s.clicks++;
  else if (e.event_name === 'sign_up') s.signups++;
  campaignStats.set(e.utm_campaign, s);
}
const topCampaigns = [...campaignStats.entries()]
  .sort((a, b) => b[1].signups - a[1].signups || b[1].visits - a[1].visits)
  .slice(0, 10);

const kpis = {
  visits: funnel[0].count,
  clicks: funnel[1].count,
  signups: funnel[2].count,
  conversionRate: funnel[0].count > 0 ? (funnel[2].count / funnel[0].count) * 100 : 0,
};

// ─────────────────────────────────────────────────────────────────────────
// 3. Render — inline SVG, no client library. Categorical palette is the dataviz skill's
//    validated reference order (see references/palette.md) — used as-is, not re-derived.
// ─────────────────────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => n.toLocaleString('en-US');

function statTile(label, value) {
  return `<div class="stat-tile"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div></div>`;
}

// Horizontal bar chart — one series, sequential-style single hue (funnel = ordered magnitude,
// not identity, per choosing-a-form.md).
function funnelChart(stages) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const barH = 24, gap = 2, rowH = barH + 20;
  const chartW = 560;
  const rows = stages.map((s, i) => {
    const w = Math.max(2, (s.count / max) * (chartW - 120));
    const y = i * rowH;
    const dropoff = i === 0 ? null : stages[i - 1].count > 0 ? 100 - (s.count / stages[i - 1].count) * 100 : null;
    return `
      <g transform="translate(0, ${y})">
        <text x="0" y="${barH / 2 + 4}" class="bar-row-label">${esc(s.label)}</text>
        <rect x="150" y="0" width="${chartW - 150}" height="${barH}" class="track" rx="4"/>
        <rect x="150" y="0" width="${w}" height="${barH}" class="series-1" rx="4">
          <title>${esc(s.label)}: ${fmt(s.count)}</title>
        </rect>
        <text x="${150 + w + 8}" y="${barH / 2 + 4}" class="bar-value">${fmt(s.count)}</text>
        ${dropoff !== null ? `<text x="${chartW + 8}" y="${barH / 2 + 4}" class="bar-dropoff">-${dropoff.toFixed(0)}%</text>` : ''}
      </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${chartW + 90} ${stages.length * rowH - (rowH - barH - gap)}" class="chart-svg" role="img" aria-label="Conversion funnel">${rows}</svg>`;
}

// Grouped horizontal bars — one group per funnel stage, one bar per source bucket (categorical).
function segmentationChart(segmentation, buckets) {
  const colorClass = (i) => `series-${i + 1}`;
  const max = Math.max(1, ...segmentation.flatMap((s) => buckets.map((b) => s.bySource.get(b) ?? 0)));
  const barH = 14, barGap = 2, groupGap = 16;
  const chartW = 480;
  const groupH = buckets.length * (barH + barGap) + groupGap;
  let y = 0;
  const groups = segmentation.map((stage) => {
    const groupStart = y;
    const bars = buckets.map((b, bi) => {
      const count = stage.bySource.get(b) ?? 0;
      const w = count > 0 ? Math.max(2, (count / max) * (chartW - 150)) : 0;
      const by = y;
      y += barH + barGap;
      return `
        <g transform="translate(0, ${by})">
          <rect x="150" y="0" width="${chartW - 150}" height="${barH}" class="track" rx="3"/>
          <rect x="150" y="0" width="${w}" height="${barH}" class="${colorClass(bi)}" rx="3">
            <title>${esc(stage.label)} — ${esc(b)}: ${fmt(count)}</title>
          </rect>
          <text x="${150 + w + 6}" y="${barH / 2 + 4}" class="bar-value-sm">${fmt(count)}</text>
        </g>`;
    }).join('');
    // Vertically center the group label against the block of bars just drawn (groupStart to
    // groupStart + buckets.length*(barH+barGap), minus the trailing gap after the last bar).
    const blockH = buckets.length * (barH + barGap) - barGap;
    const label = `<text x="0" y="${groupStart + blockH / 2 + 4}" class="bar-row-label">${esc(stage.label)}</text>`;
    y += groupGap - barGap;
    return label + bars;
  }).join('');
  const legend = buckets.map((b, i) => `<span class="legend-item"><span class="legend-swatch ${colorClass(i)}"></span>${esc(b)}</span>`).join('');
  return `
    <div class="legend">${legend}</div>
    <svg viewBox="0 0 ${chartW + 40} ${y}" class="chart-svg" role="img" aria-label="Funnel by source">${groups}</svg>`;
}

// Multi-series line chart — 3 series (visit/click/signup), categorical, direct-labeled at the
// end per marks-and-anatomy.md (converging-series risk is low here — the three stages are
// naturally ordered in magnitude, visit >= click >= signup, so end-labels rarely collide).
function trendChart(trend) {
  const W = 720, H = 220, padL = 40, padR = 90, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxY = Math.max(1, ...trend.flatMap((d) => [d.visit, d.click, d.signup]));
  const x = (i) => padL + (trend.length <= 1 ? 0 : (i / (trend.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / maxY) * plotH;

  function seriesPath(key) {
    return trend.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');
  }
  function endLabel(key, cls) {
    const last = trend[trend.length - 1];
    if (!last) return '';
    return `<circle cx="${x(trend.length - 1).toFixed(1)}" cy="${y(last[key]).toFixed(1)}" r="4" class="${cls}"/>
      <text x="${x(trend.length - 1) + 8}" y="${y(last[key]).toFixed(1) - 0}" class="line-end-label ${cls}-text">${key}: ${fmt(last[key])}</text>`;
  }
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const gy = padT + plotH * (1 - f);
    return `<line x1="${padL}" y1="${gy}" x2="${padL + plotW}" y2="${gy}" class="gridline"/>
      <text x="${padL - 8}" y="${gy + 4}" class="axis-label" text-anchor="end">${fmt(Math.round(maxY * f))}</text>`;
  }).join('');
  const xLabels = trend.length > 0
    ? [0, Math.floor((trend.length - 1) / 2), trend.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((i) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="axis-label" text-anchor="middle">${esc(trend[i].day.slice(5))}</text>`)
        .join('')
    : '';
  return `
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Daily funnel trend">
      ${gridlines}
      <path d="${seriesPath('visit')}" class="line-1" fill="none"/>
      <path d="${seriesPath('click')}" class="line-2" fill="none"/>
      <path d="${seriesPath('signup')}" class="line-3" fill="none"/>
      ${endLabel('visit', 'series-1')}
      ${endLabel('click', 'series-2')}
      ${endLabel('signup', 'series-3')}
      ${xLabels}
    </svg>`;
}

function topPagesTable(pages) {
  if (pages.length === 0) return '<p class="empty">No page visits recorded in this window.</p>';
  const rows = pages.map(([path, count]) => `<tr><td>${esc(path)}</td><td class="num">${fmt(count)}</td></tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Page</th><th class="num">Visits</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function topCampaignsTable(campaigns) {
  if (campaigns.length === 0) return '<p class="empty">No utm_campaign-tagged events recorded in this window.</p>';
  const rows = campaigns
    .map(([name, s]) => `<tr><td>${esc(name)}</td><td class="num">${fmt(s.visits)}</td><td class="num">${fmt(s.clicks)}</td><td class="num">${fmt(s.signups)}</td></tr>`)
    .join('');
  return `<table class="data-table"><thead><tr><th>Campaign</th><th class="num">Visits</th><th class="num">Clicks</th><th class="num">Sign-ups</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const hasData = events.length > 0;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vacationist — Funnel Report</title>
<style>
  :root {
    color-scheme: light;
    --surface-1: #fcfcfb; --page: #f9f9f7;
    --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #898781;
    --gridline: #e1e0d9; --baseline: #c3c2b7; --border: rgba(11,11,11,0.10);
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-1: #1a1a19; --page: #0d0d0d;
      --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #898781;
      --gridline: #2c2c2a; --baseline: #383835; --border: rgba(255,255,255,0.10);
      --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
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
  .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; }
  .stat-label { color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.35rem; }
  .stat-value { font-size: 1.6rem; font-weight: 600; }
  .chart-svg { width: 100%; height: auto; display: block; }
  .track { fill: var(--gridline); }
  .series-1 { fill: var(--series-1); } .series-2 { fill: var(--series-2); }
  .series-3 { fill: var(--series-3); } .series-4 { fill: var(--series-4); }
  .line-1 { stroke: var(--series-1); stroke-width: 2; }
  .line-2 { stroke: var(--series-2); stroke-width: 2; }
  .line-3 { stroke: var(--series-3); stroke-width: 2; }
  .bar-row-label { fill: var(--text-secondary); font-size: 12px; }
  .bar-value { fill: var(--text-primary); font-size: 12px; font-weight: 600; }
  .bar-value-sm { fill: var(--text-secondary); font-size: 10px; }
  .bar-dropoff { fill: var(--text-muted); font-size: 11px; }
  .axis-label { fill: var(--text-muted); font-size: 10px; }
  .gridline { stroke: var(--gridline); stroke-width: 1; }
  .line-end-label { font-size: 11px; font-weight: 600; }
  .series-1-text { fill: var(--series-1); } .series-2-text { fill: var(--series-2); } .series-3-text { fill: var(--series-3); }
  .legend { display: flex; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .legend-item { font-size: 0.8rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 0.4rem; }
  .legend-swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .data-table th, .data-table td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--gridline); }
  .data-table th { color: var(--text-secondary); font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: var(--text-muted); font-style: italic; }
  .footnote { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.75rem; }
</style>
</head>
<body>
<main>
  <h1>Vacationist — Funnel Report</h1>
  <p class="subtitle">Last ${DAYS} days · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${SUPABASE_URL.includes('fsfsqghbejwvgxujoyne') ? 'prod' : 'dev'}</p>

  ${!hasData ? '<div class="card"><p class="empty">No events recorded in this window yet — the pipeline is deployed but traffic hasn\'t flowed through it. Re-run once the campaign is live and consented visits start arriving.</p></div>' : ''}

  <div class="stat-row">
    ${statTile('Page visits', fmt(kpis.visits))}
    ${statTile('Store / web-app clicks', fmt(kpis.clicks))}
    ${statTile('Sign-ups', fmt(kpis.signups))}
    ${statTile('Visit → sign-up rate', kpis.conversionRate.toFixed(1) + '%')}
  </div>

  <div class="card">
    <h2>Funnel</h2>
    ${funnelChart(funnel)}
  </div>

  <div class="card">
    <h2>Funnel by source</h2>
    ${segmentationChart(segmentation, segmentBuckets)}
    <p class="footnote">"Reddit (paid)" = events carrying a Reddit click identifier (rdt_cid). Other named buckets are the next-largest utm_source values in this window; everything else folds into "Other".</p>
  </div>

  <div class="card">
    <h2>Top campaigns (by sign-ups)</h2>
    ${topCampaignsTable(topCampaigns)}
    <p class="footnote">Only events carrying a utm_campaign parameter appear here — organic/direct traffic has none and is excluded by design. Ranked by sign-ups, falling back to visits when tied.</p>
  </div>

  <div class="card">
    <h2>Daily trend</h2>
    ${trendChart(trend)}
    <div class="legend">
      <span class="legend-item"><span class="legend-swatch series-1"></span>Visit</span>
      <span class="legend-item"><span class="legend-swatch series-2"></span>Click</span>
      <span class="legend-item"><span class="legend-swatch series-3"></span>Sign up</span>
    </div>
  </div>

  <div class="card">
    <h2>Top landing pages (by visit volume)</h2>
    ${topPagesTable(topPages)}
    <p class="footnote">Ranked by visits, not by conversion — analytics_events doesn't yet link an anonymous page_visit to a later authenticated sign_up (they're different surfaces/sessions), so "top converting page" isn't computable from this table without adding session-level linking. Worth a follow-up iteration if landing-page performance becomes a real question.</p>
  </div>
</main>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────
// 4. Write + open
// ─────────────────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, 'analytics-reports');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'report.html');
writeFileSync(outFile, html, 'utf8');
console.log(`Written: ${outFile}`);

const opener = process.platform === 'win32' ? `start "" "${outFile}"` : process.platform === 'darwin' ? `open "${outFile}"` : `xdg-open "${outFile}"`;
exec(opener, (err) => {
  if (err) console.log('Could not auto-open the report — open it manually:', outFile);
});
