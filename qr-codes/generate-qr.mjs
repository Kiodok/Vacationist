#!/usr/bin/env node
/**
 * Vacationist QR Code Generator
 *
 * Renders a styled SVG QR code reproducing the qr.io template design
 * (VacationistAndroidQR_template.png) with a self-generated static QR:
 *   - real scannable QR centered in the circle: black modules, orange/white/
 *     black rounded finder patterns
 *   - decorative purple filler modules around it (exact pattern extracted from
 *     the template into template-pattern.json — never re-randomized)
 *   - purple ring border, white background, extra white canvas at the bottom
 *
 * Usage:
 *   node qr-codes/generate-qr.mjs
 *   node qr-codes/generate-qr.mjs --url "https://example.com" --output "path/to/out.svg"
 *
 * See qr-codes/README.md for full documentation.
 */

import QRCode from 'qrcode';
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── CLI arguments ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const URL_TO_ENCODE = argVal('--url') ?? 'https://vacationist.app/scan/android-qr';
const OUTPUT_PATH = argVal('--output')
  ? resolve(argVal('--output'))
  : resolve(__dir, 'Android/VacationistAndroidQR.svg');

// ─── Template design data (extracted by extract-template.mjs) ────────────────
const T = JSON.parse(readFileSync(resolve(__dir, 'Android/template-pattern.json'), 'utf8'));
const { canvas, circle, qr: tq, filler } = T;

const WHITE = '#FFFFFF';
const FILLER_RX = 3; // subtle corner rounding on decorative modules (px at 2048 scale)

// ─── QR matrix ────────────────────────────────────────────────────────────────
const qr = QRCode.create(URL_TO_ENCODE, { errorCorrectionLevel: 'M' });
const { size, data } = qr.modules;
const isDark = (r, c) => data[r * size + c] !== 0;

// The template reserves a footprint sized for a version-3 QR (29×29). A longer
// URL raises the version (more modules); the QR then renders with smaller
// modules inside the SAME footprint so the filler and quiet zone stay valid.
if (size !== tq.modules) {
  console.warn(
    `⚠ QR is version ${qr.version} (${size}×${size}), template footprint is ` +
    `${tq.modules}×${tq.modules} — rendering with smaller modules to fit. ` +
    `Consider a shorter URL to match the template exactly.`
  );
}
const PITCH = tq.span / size;          // module size inside the fixed footprint
const X0 = tq.originX;
const Y0 = tq.originY;

console.log(`URL:     ${URL_TO_ENCODE}`);
console.log(`Version: ${qr.version}  (matrix ${size}×${size}, ECC M)`);
console.log(`Output:  ${OUTPUT_PATH}`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const R = (x, y, w, h, rx, fill) =>
  `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"` +
  (rx ? ` rx="${rx.toFixed(2)}"` : '') + ` fill="${fill}"/>`;

const inFinderZone = (r, c) =>
  (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);

// ─── Build SVG ────────────────────────────────────────────────────────────────
const parts = [];

// 1. White circle background — everything outside the circle stays transparent
//    (matches the template: no drop shadow, transparent canvas)
parts.push(`<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.outerR}" fill="${WHITE}"/>`);

// 2. Decorative filler modules — exact rects extracted from the template
parts.push('<g shape-rendering="geometricPrecision">');
for (const f of filler) {
  parts.push(R(f.x, f.y, f.w, f.h, FILLER_RX, f.fill));
}
parts.push('</g>');

// 3. Real QR data modules (flush black squares), skipping finder zones.
//    Each rect bleeds 0.5px past its cell so adjacent modules merge into solid
//    blobs with no antialiased hairline seams — seams lighten the black area
//    when the image is downscaled and can break decoding at small sizes.
const BLEED = 0.5;
parts.push('<g shape-rendering="geometricPrecision">');
for (let r = 0; r < size; r++) {
  for (let c = 0; c < size; c++) {
    if (!isDark(r, c) || inFinderZone(r, c)) continue;
    parts.push(R(
      X0 + c * PITCH - BLEED, Y0 + r * PITCH - BLEED,
      PITCH + BLEED * 2, PITCH + BLEED * 2, 0, tq.moduleColor
    ));
  }
}
parts.push('</g>');

// 4. Finder patterns — geometry measured from the template:
//    orange rounded square (7 mod, rx 69/283 ≈ 24%), white gap (5 mod, rx
//    follows the orange ring's inner curve), black center (3 mod, rx 23/121 ≈ 19%)
function renderFinder(row, col) {
  const x = X0 + col * PITCH;
  const y = Y0 + row * PITCH;
  const s7 = PITCH * 7, s5 = PITCH * 5, s3 = PITCH * 3;
  const scale = s7 / tq.finder.side; // 1.0 for version-3 URLs
  const rx7 = tq.finder.orangeRadius * scale;
  const rx5 = Math.max(0, (tq.finder.orangeRadius - tq.finder.orangeStroke) * scale);
  const rx3 = tq.finder.blackRadius * scale;
  return [
    R(x, y, s7, s7, rx7, tq.finder.orangeColor),
    R(x + PITCH, y + PITCH, s5, s5, rx5, WHITE),
    R(x + PITCH * 2, y + PITCH * 2, s3, s3, rx3, tq.moduleColor),
  ].join('\n');
}
parts.push(renderFinder(0, 0));          // top-left
parts.push(renderFinder(0, size - 7));   // top-right
parts.push(renderFinder(size - 7, 0));   // bottom-left

// 5. Purple ring border
parts.push(
  `<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.outerR - circle.ringWidth / 2}" ` +
  `fill="none" stroke="${circle.ringColor}" stroke-width="${circle.ringWidth}"/>`
);

// ─── Assemble and write ───────────────────────────────────────────────────────
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     width="${canvas.width}"
     height="${canvas.height}"
     role="img"
     aria-label="Vacationist QR code — scan to download on Google Play">
${parts.join('\n')}
</svg>
`;

writeFileSync(OUTPUT_PATH, svg, 'utf8');
console.log('Done ✓');
