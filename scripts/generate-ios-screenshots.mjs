/**
 * Derives iOS 6.5" App Store screenshots from the Android Play Store screenshots.
 *
 * Source screenshots (play-store/screenshots/screenshot_*.jpg) are 1080×2460 captures
 * that include Android system chrome (status bar + 3-button nav bar). This script:
 *   1. Crops off the Android chrome (status bar top, nav bar bottom).
 *   2. Cover-scales the remaining app content to fill 1242×2688 (Apple's 6.5" bucket),
 *      trimming a small amount of background margin off each side rather than padding
 *      or stretching.
 *
 * The crop window below was measured by pixel-sampling the actual source files — it is
 * only valid for that exact 1080×2460 capture geometry (enforced by SOURCE_SIZE guard).
 *
 * Output: play-store/screenshots/<name>_ios_6.5in.jpg
 *
 * Run from repo root:  node scripts/generate-ios-screenshots.mjs
 */

import sharp from 'sharp';
import { readdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dir, '../play-store/screenshots');

const SOURCE_SIZE = { width: 1080, height: 2460 };

// App content lives between these two rows in every source file — above is the Android
// status bar, below is the Android 3-button nav bar. Bottom is the tight constraint
// (screenshot_greece_expenses_settlements has zero gap between content and nav bar there).
const CONTENT_TOP = 130;
const CONTENT_BOTTOM = 2326;
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

const TARGET = { width: 1242, height: 2688 }; // Apple 6.5" display bucket
const SUFFIX = '_ios_6.5in';

const sources = readdirSync(SCREENSHOTS_DIR)
  .filter((f) => f.startsWith('screenshot_') && f.endsWith('.jpg') && !f.includes('_ios_'))
  .sort();

if (sources.length === 0) {
  console.error(`No source screenshots found in ${SCREENSHOTS_DIR}`);
  process.exit(1);
}

console.log(`Found ${sources.length} source screenshot(s). Generating ${TARGET.width}×${TARGET.height} iOS 6.5" versions…`);

for (const file of sources) {
  const srcPath = resolve(SCREENSHOTS_DIR, file);
  const img = sharp(srcPath);
  const meta = await img.metadata();

  if (meta.width !== SOURCE_SIZE.width || meta.height !== SOURCE_SIZE.height) {
    console.error(
      `Skipping ${file}: expected ${SOURCE_SIZE.width}×${SOURCE_SIZE.height}, got ${meta.width}×${meta.height}. ` +
        `The hardcoded crop window (CONTENT_TOP/CONTENT_BOTTOM) is only valid for the expected geometry — ` +
        `re-measure before processing a differently-sized capture.`
    );
    continue;
  }

  const outName = basename(file, '.jpg') + SUFFIX + '.jpg';
  const outPath = resolve(SCREENSHOTS_DIR, outName);

  await sharp(srcPath)
    .extract({ left: 0, top: CONTENT_TOP, width: SOURCE_SIZE.width, height: CONTENT_HEIGHT })
    .resize({ width: TARGET.width, height: TARGET.height, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(outPath);

  console.log(`  ${file} -> ${outName}`);
}

console.log('Done.');
