/**
 * Derives web-optimized product screenshots for the marketing site (vacationist.app)
 * from the Play Store screenshots.
 *
 * Source screenshots (play-store/screenshots/screenshot_greece_*.jpg) are 1080×2460
 * captures that include Android system chrome (status bar top, 3-button nav bar bottom).
 * This script:
 *   1. Crops off the Android chrome (same crop window as generate-ios-screenshots.mjs).
 *   2. Down-scales the app content to a web-appropriate width and encodes WebP.
 *
 * Output: docs/assets/img/vacationist-<screen>-greece.webp
 * (~30–60 KB each vs. the 300–490 KB source JPEGs. Referenced from /features/*
 * pages and the homepage hero — see marketing/seo-strategy.md Pillar 8.)
 *
 * docs/ is generated output, but this writes an asset dir the site build doesn't
 * touch, so `npm run build:site` stays idempotent. Commit the .webp outputs.
 *
 * Run from repo root:  node scripts/generate-web-screenshots.mjs   (npm run screenshots:web)
 */

import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dir, '../play-store/screenshots');
const OUT_DIR = resolve(__dir, '../docs/assets/img');

const SOURCE_SIZE = { width: 1080, height: 2460 };

// App content lives between these two rows in every source file — above is the
// Android status bar, below is the 3-button nav bar. Identical to the constants in
// generate-ios-screenshots.mjs; keep the two in sync if a re-capture changes them.
const CONTENT_TOP = 130;
const CONTENT_BOTTOM = 2326;
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

const TARGET_WIDTH = 720; // fits the 820px article column at ~2x for retina
const WEBP_QUALITY = 80;

const sources = readdirSync(SCREENSHOTS_DIR)
  .filter((f) => f.startsWith('screenshot_greece_') && f.endsWith('.jpg') && !f.includes('_ios_'))
  .sort();

if (sources.length === 0) {
  console.error(`No source screenshots found in ${SCREENSHOTS_DIR}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Found ${sources.length} source screenshot(s). Generating ${TARGET_WIDTH}px-wide WebP…`);

for (const file of sources) {
  const srcPath = resolve(SCREENSHOTS_DIR, file);
  const meta = await sharp(srcPath).metadata();

  if (meta.width !== SOURCE_SIZE.width || meta.height !== SOURCE_SIZE.height) {
    console.error(
      `Skipping ${file}: expected ${SOURCE_SIZE.width}×${SOURCE_SIZE.height}, got ${meta.width}×${meta.height}. ` +
        `The hardcoded crop window is only valid for the expected geometry — re-measure first.`
    );
    continue;
  }

  // screenshot_greece_expenses_settlements.jpg -> vacationist-expenses-settlements-greece.webp
  const screen = basename(file, '.jpg').replace(/^screenshot_greece_/, '').replace(/_/g, '-');
  const outName = `vacationist-${screen}-greece.webp`;
  const outPath = resolve(OUT_DIR, outName);

  await sharp(srcPath)
    .extract({ left: 0, top: CONTENT_TOP, width: SOURCE_SIZE.width, height: CONTENT_HEIGHT })
    .resize({ width: TARGET_WIDTH })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outPath);

  console.log(`  ${file} -> assets/img/${outName}`);
}

console.log('Done.');
