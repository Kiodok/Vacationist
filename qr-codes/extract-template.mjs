#!/usr/bin/env node
/**
 * Template pattern extractor (one-time tool).
 *
 * Reads qr-codes/Android/VacationistAndroidQR_template.png (the original qr.io
 * design) and measures everything generate-qr.mjs needs to reproduce it:
 *   - circle center, radius, ring stroke width + color
 *   - the central QR footprint (origin + module pitch) and finder geometry
 *   - every decorative purple filler module as an exact rect (position, size,
 *     sampled color) via connected-component analysis — the filler is NOT on
 *     the same grid as the QR (qr.io draws it independently, pitch ~35.7px vs
 *     the QR's 40.45px, with slight jitter), so components are measured
 *     individually and multi-module blobs are subdivided by the filler pitch.
 *
 * Output: qr-codes/Android/template-pattern.json (checked in).
 * Re-run only if the template PNG itself changes.
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(__dir, 'Android/VacationistAndroidQR_template.png');
const OUTPUT = resolve(__dir, 'Android/template-pattern.json');
const QR_MODULES = 29;        // template's center QR is version 3 (29×29)
const FILLER_PITCH = 35.7;    // measured decorative module quantum (px)
const MIN_COMPONENT_AREA = 250; // px² — ignore antialiasing specks

const { data, info } = await sharp(TEMPLATE)
  .flatten({ background: '#ffffff' })
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: CH } = info;

const px = (x, y) => {
  const i = (Math.round(y) * W + Math.round(x)) * CH;
  return [data[i], data[i + 1], data[i + 2]];
};

const isWhite = ([r, g, b]) => r > 235 && g > 235 && b > 235;
const isBlack = ([r, g, b]) => r < 70 && g < 70 && b < 70;
const isOrange = ([r, g, b]) => r > 200 && g > 110 && g < 210 && b < 130;
// Purple-ish of any lightness (dark ring purple through pale lavender)
const isPurplish = ([r, g, b]) =>
  !(r > 245 && g > 245 && b > 245) && r >= g && b >= g && (r - g) + (b - g) > 10 && g > 60;

const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// ─── 1. Circle geometry ───────────────────────────────────────────────────────
const cxGuess = Math.floor(W / 2);
let top = -1, ringBottom = -1;
for (let y = 0; y < H; y++) {
  if (isPurplish(px(cxGuess, y))) { if (top === -1) top = y; ringBottom = y; }
}
const cy = (top + ringBottom) / 2;
let left = -1, right = -1;
for (let x = 0; x < W; x++) {
  if (isPurplish(px(x, cy))) { if (left === -1) left = x; right = x; }
}
const cx = (left + right) / 2;
const outerR = (right - left) / 2;
let ringInnerX = left;
for (let x = left; x < cx; x++) {
  if (isPurplish(px(x, cy))) ringInnerX = x; else if (x - left > 5) break;
}
const ringW = ringInnerX - left + 1;
const innerR = outerR - ringW;

// ring color: average pure ring pixels on the centerline stroke
{
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = left + 4; x <= ringInnerX - 4; x++) {
    const p = px(x, cy); r += p[0]; g += p[1]; b += p[2]; n++;
  }
  var ringColor = hex([r / n, g / n, b / n]);
}

// ─── 2. Central QR footprint (bbox of black|orange pixels) ───────────────────
let qx0 = W, qy0 = H, qx1 = 0, qy1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = px(x, y);
    if (isBlack(p) || isOrange(p)) {
      if (x < qx0) qx0 = x;
      if (x > qx1) qx1 = x;
      if (y < qy0) qy0 = y;
      if (y > qy1) qy1 = y;
    }
  }
}
const pitch = ((qx1 - qx0 + 1) + (qy1 - qy0 + 1)) / 2 / QR_MODULES;

// ─── 3. Finder geometry (TL finder) ───────────────────────────────────────────
// orange rounded-square ring: outer bbox + corner radius + stroke thickness
let ox0 = W, oy0 = H, ox1 = 0, oy1 = 0;
const scan = Math.round(pitch * 8);
for (let y = qy0 - 4; y < qy0 + scan; y++) {
  for (let x = qx0 - 4; x < qx0 + scan; x++) {
    if (isOrange(px(x, y))) {
      if (x < ox0) ox0 = x; if (x > ox1) ox1 = x;
      if (y < oy0) oy0 = y; if (y > oy1) oy1 = y;
    }
  }
}
let orangeRx = 0;
for (let x = ox0; x < ox1; x++) if (isOrange(px(x, oy0 + 2))) { orangeRx = x - ox0; break; }
let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
for (let y = oy0; y <= oy1; y++) {
  for (let x = ox0; x <= ox1; x++) {
    if (isBlack(px(x, y))) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
}
let blackRx = 0;
for (let x = bx0; x < bx1; x++) if (isBlack(px(x, by0 + 2))) { blackRx = x - bx0; break; }
const finderSide = ((ox1 - ox0 + 1) + (oy1 - oy0 + 1)) / 2;

// ─── 4. Decorative filler via connected components ────────────────────────────
// mask: purplish pixels strictly inside the ring's inner edge
const mask = new Uint8Array(W * H);
const rLimit = innerR - 3;
const yLo = Math.max(0, Math.floor(cy - rLimit)), yHi = Math.min(H - 1, Math.ceil(cy + rLimit));
for (let y = yLo; y <= yHi; y++) {
  const halfW = Math.sqrt(Math.max(0, rLimit * rLimit - (y - cy) * (y - cy)));
  const xLo = Math.max(0, Math.floor(cx - halfW)), xHi = Math.min(W - 1, Math.ceil(cx + halfW));
  for (let x = xLo; x <= xHi; x++) {
    if (isPurplish(px(x, y))) mask[y * W + x] = 1;
  }
}

// 4-connected flood fill (iterative BFS)
const labels = new Int32Array(W * H);
const components = [];
const queue = new Int32Array(W * H);
for (let i = 0; i < W * H; i++) {
  if (!mask[i] || labels[i]) continue;
  const id = components.length + 1;
  let head = 0, tail = 0;
  queue[tail++] = i;
  labels[i] = id;
  let minX = W, minY = H, maxX = 0, maxY = 0, area = 0;
  while (head < tail) {
    const j = queue[head++];
    const x = j % W, y = (j / W) | 0;
    area++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const k of [j - 1, j + 1, j - W, j + W]) {
      if (k >= 0 && k < W * H && mask[k] && !labels[k]) { labels[k] = id; queue[tail++] = k; }
    }
  }
  components.push({ minX, minY, maxX, maxY, area });
}

// subdivide each component by the filler pitch; sample each sub-cell's color
const filler = [];
for (const comp of components) {
  if (comp.area < MIN_COMPONENT_AREA) continue;
  const w = comp.maxX - comp.minX + 1;
  const h = comp.maxY - comp.minY + 1;
  const nx = Math.max(1, Math.round(w / FILLER_PITCH));
  const ny = Math.max(1, Math.round(h / FILLER_PITCH));
  const cw = w / nx, chh = h / ny;
  for (let sy = 0; sy < ny; sy++) {
    for (let sx = 0; sx < nx; sx++) {
      const x0 = comp.minX + sx * cw, y0 = comp.minY + sy * chh;
      // average mask pixels in the central 70% of the sub-cell
      let r = 0, g = 0, b = 0, n = 0, total = 0;
      for (let y = Math.round(y0 + chh * 0.15); y < y0 + chh * 0.85; y++) {
        for (let x = Math.round(x0 + cw * 0.15); x < x0 + cw * 0.85; x++) {
          total++;
          if (!mask[y * W + x]) continue;
          const p = px(x, y); r += p[0]; g += p[1]; b += p[2]; n++;
        }
      }
      if (!total || n / total < 0.4) continue; // empty corner of an L-shaped blob
      filler.push({
        x: +x0.toFixed(1), y: +y0.toFixed(1),
        w: +cw.toFixed(1), h: +chh.toFixed(1),
        fill: hex([r / n, g / n, b / n]),
      });
    }
  }
}

// ─── 5. Shadow check below the circle ─────────────────────────────────────────
let shadowMinLum = 255;
for (let y = Math.round(cy + outerR + 5); y < H - 2; y += 3) {
  for (let x = 10; x < W - 10; x += 5) {
    const [r, g, b] = px(x, y);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (l < shadowMinLum) shadowMinLum = l;
  }
}

// ─── Write result ─────────────────────────────────────────────────────────────
const result = {
  source: 'VacationistAndroidQR_template.png',
  canvas: { width: W, height: H },
  circle: {
    cx: +cx.toFixed(1), cy: +cy.toFixed(1),
    outerR: +outerR.toFixed(1), innerR: +innerR.toFixed(1),
    ringWidth: ringW, ringColor,
  },
  qr: {
    originX: qx0, originY: qy0,
    span: +(((qx1 - qx0 + 1) + (qy1 - qy0 + 1)) / 2).toFixed(1),
    modules: QR_MODULES, pitch: +pitch.toFixed(4),
    moduleColor: '#000000',
    finder: {
      side: +finderSide.toFixed(1),
      orangeColor: hex(px(ox0 + Math.round(finderSide / 2), oy0 + 3)),
      orangeRadius: orangeRx,
      orangeStroke: Math.round(pitch), // 1 module thick
      blackSide: +(((bx1 - bx0 + 1) + (by1 - by0 + 1)) / 2).toFixed(1),
      blackRadius: blackRx,
    },
  },
  shadow: { minLuminanceBelowCircle: +shadowMinLum.toFixed(1), present: shadowMinLum < 245 },
  fillerCount: filler.length,
  filler,
};

writeFileSync(OUTPUT, JSON.stringify(result, null, 1).replace(
  /\{\n\s+"x": ([\d.]+),\n\s+"y": ([\d.]+),\n\s+"w": ([\d.]+),\n\s+"h": ([\d.]+),\n\s+"fill": "(#\w+)"\n\s+\}/g,
  '{"x":$1,"y":$2,"w":$3,"h":$4,"fill":"$5"}'
), 'utf8');

console.log(`canvas   ${W}×${H}`);
console.log(`circle   center (${cx.toFixed(1)}, ${cy.toFixed(1)})  outerR ${outerR.toFixed(1)}  ring ${ringW}px ${ringColor}`);
console.log(`QR       origin (${qx0},${qy0})  pitch ${pitch.toFixed(3)}px  (${QR_MODULES}×${QR_MODULES})`);
console.log(`finder   side ${finderSide.toFixed(1)}  orangeRx ${orangeRx}  blackSide ${((bx1 - bx0 + 1 + by1 - by0 + 1) / 2).toFixed(1)}  blackRx ${blackRx}`);
console.log(`shadow   present=${shadowMinLum < 245} (min lum ${shadowMinLum.toFixed(1)})`);
console.log(`filler   ${filler.length} modules from ${components.filter((c) => c.area >= MIN_COMPONENT_AREA).length} components`);
console.log(`\nWrote ${OUTPUT}`);
