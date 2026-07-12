#!/usr/bin/env node
/**
 * QR scanability verifier.
 *
 * Rasterizes the QR (SVG or PNG) flattened onto white — like paper — at several
 * sizes and decodes each with zxing-wasm (the same detector family real phone
 * scanners use). The decorative purple filler makes decoding harder than a
 * plain QR, so multi-size testing matters: the original qr.io template decodes
 * at 800px and above; the generated QR must do the same.
 *
 * Exits non-zero if any test size fails or the decoded text mismatches.
 *
 * Usage:
 *   node qr-codes/verify-qr.mjs
 *   node qr-codes/verify-qr.mjs --input "path/to/qr.svg" --url "https://expected"
 */

import sharp from 'sharp';
import { readBarcodes } from 'zxing-wasm/reader';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const INPUT = resolve(argVal('--input') ?? resolve(__dir, 'Android/VacationistAndroidQR.svg'));
const EXPECTED = argVal('--url') ?? 'https://vacationist.app/scan/android-qr';
const SIZES = [800, 1024, 1400, 2048]; // the template itself decodes at all of these

let failed = false;
for (const size of SIZES) {
  const { data, info } = await sharp(INPUT)
    .flatten({ background: '#ffffff' })
    .resize(size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const results = await readBarcodes(
    { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height },
    { formats: ['QRCode'], tryHarder: true }
  );
  const text = results.find((r) => r.isValid)?.text;
  if (text === EXPECTED) {
    console.log(`✓ ${size}px: decoded correctly`);
  } else if (text) {
    console.error(`✗ ${size}px: decoded "${text}" — expected "${EXPECTED}"`);
    failed = true;
  } else {
    console.error(`✗ ${size}px: could not decode`);
    failed = true;
  }
}

if (failed) {
  console.error('\nFAIL — do not ship this QR. See qr-codes/README.md.');
  process.exit(1);
}
console.log(`\nOK: "${EXPECTED}" decodes at all ${SIZES.length} test sizes.`);
