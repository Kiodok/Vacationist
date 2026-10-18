/**
 * Generates the App Store Connect "search results" creative asset
 * (Produktseiteninformationen → Suchergebnisse), new in iOS 27 / iPadOS 27.
 * Output: app-store/creative-assets/search-3840x2560-en.png
 *
 * Spec (verified against Apple's own PSD template, same method as
 * generate-appstore-creative.mjs — see app-store/creative-assets/README.md):
 *   - Canvas 3840×2560 (3:2), no alpha channel.
 *   - "Art Safe Area" layer in Apple's template: x 836–3004, y 765–1795
 *     (2168×1030, centred).
 *
 * Unlike the header, Apple's own practical guidance for this placement is the
 * opposite of text-free brand art: "state the obvious," show firsthand UI, one
 * large screen rather than a collage (small screenshots are illegible at
 * search-card thumbnail size, ~384px wide). So this composites a real
 * screenshot via the same phone-frame pipeline as the Product Hunt gallery
 * (scripts/generate-producthunt-assets.mjs's screenCard()), not another
 * brand-only card like the header.
 *
 * Hero screen + headline (Tech Lead decision, 2026-10-18): Balances &
 * Settlements (screenshot_greece_expenses_settlements.jpg — the settle-up
 * card and the app's only donut chart), paired with the already-approved
 * Product Hunt copy for this exact slug — reused verbatim, not reworded:
 * eyebrow "SPLIT EXPENSES", headline "Split every cost." / "Know who owes
 * what." EN-only for now — no German screenshot exists anywhere in the repo
 * (see app-store/creative-assets/README.md).
 *
 * Run from repo root:  node scripts/generate-appstore-search-card.mjs   (npm run assets:appstore-search)
 * Flags:
 *   --proof   writes a safe-area-overlay PNG and a safe-box crop to the
 *             scratchpad (APPSTORE_PROOF_DIR) for verification — never into the repo
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { phoneLayer, clipToCanvas } from './lib/phoneFrame.mjs';
import { FONT, escXml } from './lib/brandSvg.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dir, '../app-store/creative-assets');
const OUT_FILE = resolve(OUT_DIR, 'search-3840x2560-en.png');

mkdirSync(OUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const proof = args.includes('--proof');

const W = 3840;
const H = 2560;

// Apple's "Art Safe Area" layer, read directly from their official PSD template.
const SAFE = { left: 836, top: 765, right: 3004, bottom: 1795 };
const SAFE_W = SAFE.right - SAFE.left; // 2168
const SAFE_H = SAFE.bottom - SAFE.top; // 1030

/* ── Palette — same warm "colorful" theme as the header, for visual
   continuity between the two Apple assets ─────────────────────────────── */
const BG_0 = '#F08A2E';
const BG_55 = '#FDA444';
const BG_100 = '#FECE8A';
const TEXT = '#690F0C';
const ACCENT = '#8c6196';
const ACCENT_WARM = '#E08A25';
const DOT = '#690F0C';

/* ── Phone placement (tuned against the real render — see --proof) ─────── */
const PHONE_FILE = 'screenshot_greece_expenses_settlements.jpg';
const PHONE_W = 1500;
const PHONE_TOP = 664;
const PHONE_LEFT = 2240;

/* ── Headline (reused verbatim from generate-producthunt-assets.mjs's
   caption table for this exact slug — not reworded) ────────────────────── */
const EYEBROW = 'SPLIT EXPENSES';
const HEADLINE = ['Split every cost.', 'Know who owes what.'];
const TEXT_X = SAFE.left + 64; // 900
const TEXT_MAX_W = PHONE_LEFT - TEXT_X - 120; // clear of the phone with margin

/* ── SVG pieces ──────────────────────────────────────────────────────────── */

function dotGrid() {
  // Sparse, confined to the top-left/bottom-left — the phone and headline
  // already carry the composition, this is texture, not a second focal point.
  const cells = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 9; col++) {
      const x = 80 + col * 90;
      const y = 60 + row * 90;
      if (x > TEXT_X + TEXT_MAX_W && y > SAFE.top - 100 && y < SAFE.bottom + 400) continue; // stay clear of the headline block
      const opacity = (0.04 + Math.sin(col + row) * 0.018).toFixed(3);
      cells.push(`<circle cx="${x}" cy="${y}" r="3" fill="${DOT}" opacity="${opacity}"/>`);
    }
  }
  return cells.join('');
}

const bleedMotifs = `
  ${dotGrid()}
  <line x1="180" y1="2140" x2="700" y2="2380" stroke="${ACCENT}" stroke-width="2" opacity="0.18" stroke-dasharray="16 10"/>
  <g transform="translate(220, 2260)" opacity="0.26">
    <circle cx="0" cy="-12" r="16" fill="${ACCENT_WARM}"/>
    <path d="M-7,0 Q0,25 0,25 Q0,25 7,0 Z" fill="${ACCENT_WARM}"/>
    <circle cx="0" cy="-12" r="6" fill="${BG_100}"/>
  </g>
  <g transform="translate(140, 320) rotate(-22) scale(2.2)" opacity="0.20">
    <path d="M0,0 L28,-7 L22,0 L28,7 Z" fill="${ACCENT}"/>
    <path d="M4,-2 L-10,-18 L-15,-15 L-2,-2 Z" fill="${ACCENT}" opacity="0.75"/>
    <path d="M4,2  L-10,18  L-15,15  L-2,2  Z" fill="${ACCENT}" opacity="0.75"/>
    <rect x="-18" y="-1" width="8" height="2" rx="1" fill="${ACCENT}"/>
  </g>`;

/** Soft drop shadow under the phone, drawn into the background so it never needs its own layer. */
function phoneShadow(left, top, ow, oh, radius) {
  return `<rect x="${left}" y="${top + 30}" width="${ow}" height="${oh}" rx="${radius}" fill="#000" opacity="0.28" filter="url(#shadow)"/>`;
}

/** Eyebrow pill + two-line headline, left-aligned, auto-fit to TEXT_MAX_W (same heuristic as og-image.mjs / generate-producthunt-assets.mjs). */
function textBlock() {
  const longest = Math.max(...HEADLINE.map((l) => l.length));
  const hSize = Math.min(150, Math.floor(TEXT_MAX_W / (longest * 0.56)));
  const hLine = Math.round(hSize * 1.2);

  const pillH = 76;
  const gap = 70;
  const total = pillH + gap + HEADLINE.length * hLine;
  const top = Math.round(SAFE.top + (SAFE_H - total) / 2 + 80); // weighted toward the upper-middle of the safe box

  const pillW = Math.round(EYEBROW.length * 26 + 80);
  const hTop = top + pillH + gap;

  const headSvg = HEADLINE.map(
    (line, i) =>
      `<text x="${TEXT_X}" y="${hTop + Math.round(hSize * 0.88) + i * hLine}" font-family="${FONT}" font-size="${hSize}" font-weight="800" letter-spacing="-1.5" fill="${TEXT}">${escXml(line)}</text>`,
  ).join('\n  ');

  return `<rect x="${TEXT_X}" y="${top}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${ACCENT}" fill-opacity="0.16" stroke="${ACCENT}" stroke-opacity="0.65" stroke-width="2.5"/>
  <text x="${TEXT_X + pillW / 2}" y="${top + pillH / 2 + 10}" text-anchor="middle" font-family="${FONT}" font-size="32" font-weight="700" letter-spacing="4" fill="${ACCENT}">${escXml(EYEBROW)}</text>
  ${headSvg}`;
}

/* ── Compose ────────────────────────────────────────────────────────────── */

console.log('Loading and framing the source screenshot …');
const layer = await phoneLayer(PHONE_FILE, PHONE_W);

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="${BG_0}"/>
      <stop offset="55%"  stop-color="${BG_55}"/>
      <stop offset="100%" stop-color="${BG_100}"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${bleedMotifs}
  ${phoneShadow(PHONE_LEFT, PHONE_TOP, layer.width, layer.height, layer.radius)}
  ${textBlock()}
</svg>`;

console.log('Rendering SVG background …');
const base = await sharp(Buffer.from(svg)).png().toBuffer();

const phoneOverlay = await clipToCanvas(layer, PHONE_TOP, H);
console.log('Compositing phone …');
// flatten() must run in its own pipeline stage after the composite is
// materialized — chained in the same call, sharp keeps the alpha channel
// (verified empirically; Apple requires no alpha channel on this asset).
const composited = await sharp(base)
  .composite(phoneOverlay ? [{ input: phoneOverlay, left: PHONE_LEFT, top: PHONE_TOP }] : [])
  .png()
  .toBuffer();

console.log('Flattening (no alpha) …');
await sharp(composited)
  .flatten({ background: BG_55 })
  .png({ compressionLevel: 9, adaptiveFiltering: false })
  .toFile(OUT_FILE);

const meta = await sharp(OUT_FILE).metadata();
console.log(`Done: ${OUT_FILE}`);
console.log(`  ${meta.width}x${meta.height}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`);

if (proof) {
  const scratchDir = process.env.APPSTORE_PROOF_DIR;
  if (!scratchDir) {
    console.warn('--proof requested but APPSTORE_PROOF_DIR is not set — skipping proof renders.');
  } else {
    mkdirSync(scratchDir, { recursive: true });

    const overlaySvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${SAFE.left}" y="${SAFE.top}" width="${SAFE_W}" height="${SAFE_H}"
            fill="none" stroke="#00FF00" stroke-width="6" stroke-dasharray="20 12"/>
    </svg>`;
    await sharp(OUT_FILE)
      .composite([{ input: Buffer.from(overlaySvg) }])
      .png()
      .toFile(resolve(scratchDir, 'search-safe-area-overlay.png'));

    await sharp(OUT_FILE)
      .extract({ left: SAFE.left, top: SAFE.top, width: SAFE_W, height: SAFE_H })
      .png()
      .toFile(resolve(scratchDir, 'search-crop-safe-box.png'));

    // Thumbnail simulation — the actual search-result card is ~384px wide.
    await sharp(OUT_FILE)
      .resize({ width: 384 })
      .png()
      .toFile(resolve(scratchDir, 'search-thumbnail-384w.png'));

    console.log(`Proof renders written to: ${scratchDir}`);
  }
}
