#!/usr/bin/env node
/**
 * Growth Plan Q4 2026, Phase 2 — refreshes marketing/site/store-ratings.json, the single source
 * of truth marketing/site/build.mjs reads to (once the count clears REVIEW_SCHEMA_MIN) show a
 * visible rating line on the homepage and add `aggregateRating` JSON-LD (seo-strategy.md
 * Pillar 4 — never estimate or round this number; it must match what a visitor can see).
 *
 * App Store: fetched live and free from the public, unauthenticated iTunes Lookup API
 * (no App Store Connect credentials needed). Ratings are PER STOREFRONT on Apple's side, so
 * this pulls a handful of storefronts and combines them count-weighted.
 *
 * Play Store: fetched from the private per-developer-account Cloud Storage bucket of monthly
 * ratings CSVs, using a DEDICATED, minimal-permission service account
 * (play-ratings-reader@vacationist.iam.gserviceaccount.com — created 2026-09-17, zero IAM roles
 * on the vacationist GCP project; its only access is a Play Console account-level permission
 * grant, "View app information and download bulk reports (read only)"). Deliberately NOT the
 * eas.json play-store-service-account.json used for EAS submit — that one is scoped for
 * publishing releases, far broader than reading a stats bucket.
 *
 * One-time setup (see the marketing-growth-plan-q4-2026 skill for the full record):
 *   1. play-ratings-service-account.json must exist at the repo root (gitignored, never
 *      committed — see .gitignore). Regenerate via:
 *        gcloud iam service-accounts keys create play-ratings-service-account.json \
 *          --iam-account=play-ratings-reader@vacationist.iam.gserviceaccount.com
 *   2. That service account's email must be invited in Play Console → Users and permissions →
 *      Invite new users → Account permissions tab → "View app information and download bulk
 *      reports (read only)" (account-level only — Google doesn't offer a narrower scope for
 *      bucket access). This step has no API; only a human with Play Console access can do it.
 *   3. The bucket ID has no discovery API either (Google's own limitation) — copy it from
 *      Play Console → Statistics → Download reports (Cloud Storage URI, format
 *      pubsite_prod_rev_<digits>) and pass it once via --play-bucket=<id>; it's cached in
 *      store-ratings.json (playStore.bucket) so later runs don't need it again.
 *
 * Without the key file or the bucket id, Play Store falls back to manual entry exactly as
 * before: --play-rating=<v> --play-count=<n> from Play Console → Ratings.
 *
 * Run:    node scripts/fetch-store-ratings.mjs [--play-bucket=pubsite_prod_rev_...]
 *                                              [--play-rating=4.8] [--play-count=27]
 * Output: marketing/site/store-ratings.json (committed — the published number must be visible
 *         in a git diff, never silently live-updated).
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const OUT_FILE = resolve(ROOT, 'marketing/site/store-ratings.json');
const PLAY_SA_KEY_FILE = resolve(ROOT, 'play-ratings-service-account.json');
const PLAY_PACKAGE_NAME = 'com.vacationist.mobile';

const APP_STORE_ID = '6800049398';
// A handful of storefronts covering the app's real audience (DACH-focused paid channel + the
// two global App Store defaults). Not exhaustive — Apple has 175 storefronts; this is a
// reasonable approximation, not a claim of "every region".
const STOREFRONTS = ['de', 'at', 'ch', 'us', 'gb'];

function argValue(prefix) {
  const a = process.argv.find((x) => x.startsWith(prefix));
  return a ? a.slice(prefix.length) : undefined;
}
const playRatingArg = argValue('--play-rating=');
const playCountArg = argValue('--play-count=');
const playBucketArg = argValue('--play-bucket=');

async function fetchAppStoreStorefront(cc) {
  const url = `https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=${cc}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! ${cc}: HTTP ${res.status}`);
    return null;
  }
  const json = await res.json();
  const result = json.results?.[0];
  if (!result) {
    console.warn(`  ! ${cc}: not found on this storefront`);
    return null;
  }
  return {
    ratingValue: result.averageUserRating ?? 0,
    ratingCount: result.userRatingCount ?? 0,
  };
}

console.log(`Fetching App Store ratings for id ${APP_STORE_ID} across ${STOREFRONTS.length} storefronts …`);
const byStorefront = {};
for (const cc of STOREFRONTS) {
  const r = await fetchAppStoreStorefront(cc);
  if (r) {
    byStorefront[cc] = r;
    console.log(`  ${cc}: ${r.ratingValue} (${r.ratingCount})`);
  }
}

const totalCount = Object.values(byStorefront).reduce((sum, r) => sum + r.ratingCount, 0);
const weightedSum = Object.values(byStorefront).reduce((sum, r) => sum + r.ratingValue * r.ratingCount, 0);
const appStore = {
  ratingValue: totalCount > 0 ? Math.round((weightedSum / totalCount) * 100) / 100 : null,
  ratingCount: totalCount,
  byStorefront,
  source: 'itunes-lookup',
  checkedAt: new Date().toISOString().slice(0, 10),
};

// ─────────────────────────────────────────────────────────────────────────
// Play Store — automated fetch from the private ratings-CSV bucket, if the dedicated
// service account key + bucket id are available; otherwise fall back to manual entry.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Google's own guidance for these exports: don't rely on column position, the shape has changed
 * across report versions. Match by header name instead, and fail loudly (never guess) if the
 * expected columns aren't found — the Pillar 4 rule against estimating applies just as much to
 * "probably the 5th column" as to a hand-typed number.
 */
function parseRatingsOverviewCsv(text, sourceLabel) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error(`${sourceLabel}: file has no data rows`);
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const findCol = (pattern) => header.findIndex((h) => pattern.test(h));
  const valueCol = findCol(/^total average rating$/i);
  const countCol = findCol(/^total average rating count$/i);
  if (valueCol === -1 || countCol === -1) {
    throw new Error(
      `${sourceLabel}: expected "Total Average Rating" / "Total Average Rating Count" columns not found.\n` +
        `Raw header: ${JSON.stringify(header)}\n` +
        `Fix parseRatingsOverviewCsv() in scripts/fetch-store-ratings.mjs to match the real column names, then re-run.`,
    );
  }
  // Last data row = most recent day in this month's file = the current lifetime cumulative total.
  const lastRow = lines[lines.length - 1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const ratingValue = parseFloat(lastRow[valueCol]);
  const ratingCount = parseInt(lastRow[countCol], 10);
  if (!Number.isFinite(ratingValue) || !Number.isFinite(ratingCount)) {
    throw new Error(`${sourceLabel}: could not parse numbers from last row: ${JSON.stringify(lastRow)}`);
  }
  return { ratingValue, ratingCount };
}

async function fetchPlayStoreFromBucket(bucketId) {
  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage({ keyFilename: PLAY_SA_KEY_FILE });
  const bucket = storage.bucket(bucketId);
  const prefix = `stats/ratings/ratings_${PLAY_PACKAGE_NAME}_`;
  const [files] = await bucket.getFiles({ prefix });
  const overviewFiles = files
    .map((f) => f.name)
    .filter((n) => n.endsWith('_overview.csv'))
    .sort()
    .reverse(); // filenames embed yyyyMM, so lexical sort = chronological
  if (overviewFiles.length === 0) {
    throw new Error(`No "${prefix}*_overview.csv" files found in gs://${bucketId}/stats/ratings/`);
  }
  // Reports post 3–7 days into the month for the prior month, so the newest file can be present
  // but nearly empty right after month-end — try it, fall back to the previous month on failure.
  let lastError;
  for (const name of overviewFiles.slice(0, 2)) {
    try {
      const [contents] = await bucket.file(name).download();
      const text = contents.toString('utf16le').replace(/^﻿/, '');
      const result = parseRatingsOverviewCsv(text, name);
      console.log(`  Parsed ${name}: ${result.ratingValue} (${result.ratingCount})`);
      return result;
    } catch (err) {
      console.warn(`  ! ${name}: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError;
}

let playStore = { ratingValue: null, ratingCount: null, bucket: null, source: 'manual', checkedAt: null };
if (existsSync(OUT_FILE)) {
  try {
    const prev = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    if (prev.playStore) playStore = { bucket: null, ...prev.playStore };
  } catch {
    // ignore malformed previous file — start fresh
  }
}

const bucketId = playBucketArg || playStore.bucket;
if (playRatingArg && playCountArg) {
  playStore = {
    ratingValue: parseFloat(playRatingArg),
    ratingCount: parseInt(playCountArg, 10),
    bucket: bucketId || null,
    source: 'manual',
    checkedAt: new Date().toISOString().slice(0, 10),
  };
} else if (existsSync(PLAY_SA_KEY_FILE) && bucketId) {
  console.log(`\nFetching Play Store ratings from gs://${bucketId} …`);
  try {
    const r = await fetchPlayStoreFromBucket(bucketId);
    playStore = { ...r, bucket: bucketId, source: 'play-console-bucket', checkedAt: new Date().toISOString().slice(0, 10) };
  } catch (err) {
    console.warn(`  ! Automated Play Store fetch failed: ${err.message}`);
    console.warn('  Falling back to the last known value (if any) — verify manually if this persists.');
  }
} else if (!existsSync(PLAY_SA_KEY_FILE)) {
  console.log('\nplay-ratings-service-account.json not found — Play Store rating stays manual.');
  console.log('  npm run ratings:sync -- --play-rating=<value> --play-count=<count>');
} else if (!bucketId) {
  console.log('\nNo Play Store bucket id known yet. Find it in Play Console → Statistics → Download');
  console.log('reports (Cloud Storage URI), then run once with --play-bucket=<id> to cache it.');
}

const staleDays = playStore.checkedAt
  ? Math.floor((Date.now() - new Date(playStore.checkedAt).getTime()) / 86_400_000)
  : null;
if (playStore.ratingValue === null) {
  // already logged above
} else if (staleDays !== null && staleDays > 30 && playStore.source === 'manual') {
  console.log(`\n⚠ Play Store rating is ${staleDays} days old (last checked ${playStore.checkedAt}) — verify it's still current in Play Console.`);
} else {
  console.log(`\nPlay Store rating: ${playStore.ratingValue} (${playStore.ratingCount}), checked ${playStore.checkedAt}, source ${playStore.source}.`);
}

const combinedCount = (appStore.ratingCount || 0) + (playStore.ratingCount || 0);
const combinedValue =
  combinedCount > 0
    ? Math.round(
        (((appStore.ratingValue || 0) * (appStore.ratingCount || 0) +
          (playStore.ratingValue || 0) * (playStore.ratingCount || 0)) /
          combinedCount) *
          100,
      ) / 100
    : null;

const output = { appStore, playStore, combined: { ratingValue: combinedValue, ratingCount: combinedCount } };
writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`\nWritten: ${OUT_FILE}`);
console.log(`Combined: ${combinedValue ?? 'n/a'} across ${combinedCount} rating(s).`);
console.log('Review the diff before committing — the published number must match both consoles exactly.');
