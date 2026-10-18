/**
 * Generates the App Store Connect "product page header" creative asset
 * (Produktseiteninformationen → Kopfzeile), new in iOS 27 / iPadOS 27.
 * Output: app-store/creative-assets/header-3840x1646.png
 *
 * Spec (verified against Apple's own PSD template, not just third-party docs —
 * see app-store/creative-assets/README.md for how):
 *   - Canvas 3840×1646 (21:9), no alpha channel.
 *   - "Art Safe Area" layer in Apple's template: x 1097–2743, y 493–1154
 *     (1646×661, centred). Anything outside it may be cropped on some device/
 *     orientation combination — only the brand lockup goes inside it; motifs
 *     and gradient are free bleed.
 *
 * Text-free by design (Tech Lead decision, 2026-10-18): app mark + wordmark
 * only, no sentence copy, so ONE asset serves both EN and DE localizations.
 * Palette is the warm "colorful" theme (CLAUDE.md palette table) to stay
 * continuous with the live App Store screenshots, which are colorful-mode
 * captures — not the dark/violet palette used by the app icon, website, and
 * play-store/header.png.
 *
 * Run from repo root:  node scripts/generate-appstore-creative.mjs   (npm run assets:appstore)
 * Flags:
 *   --variant=stacked   lockup with the mark above the wordmark instead of beside it
 *                        (for ASC Preview comparison — the real app icon sits next to
 *                        the header on the product page, so the default horizontal
 *                        lockup may read as a duplicated icon; judge both in Preview)
 *   --proof              also writes safe-area-overlay + crop-simulation PNGs to the
 *                        scratchpad for verification (never into the repo)
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FONT, brandDefs, logoMark } from './lib/brandSvg.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dir, '../app-store/creative-assets');
const OUT_FILE = resolve(OUT_DIR, 'header-3840x1646.png');

mkdirSync(OUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const variant = (args.find((a) => a.startsWith('--variant=')) || '').split('=')[1] || 'horizontal';
const proof = args.includes('--proof');

const W = 3840;
const H = 1646;

// Apple's "Art Safe Area" layer, read directly from their official PSD template.
const SAFE = { left: 1097, top: 493, right: 2743, bottom: 1154 };
const SAFE_W = SAFE.right - SAFE.left; // 1646
const SAFE_H = SAFE.bottom - SAFE.top; // 661
const SAFE_CX = (SAFE.left + SAFE.right) / 2; // 1920 (== W / 2)
const SAFE_CY = (SAFE.top + SAFE.bottom) / 2; // 823.5 (== H / 2)

/* ── Brand lockup (text-free, app mark + wordmark) ─────────────────────── */

// The real 44×44 app-icon mark from brandSvg.mjs, scaled up. A round scale
// factor keeps its rx proportionate (10 * 6.818 ≈ 68, matching the design).
const MARK_SRC = 44;
const MARK_SIZE = 300;
const MARK_SCALE = MARK_SIZE / MARK_SRC;

const WORD_FONT_SIZE = 165;
const WORD_LETTER_SPACING = -4;
const GAP = 70;

function horizontalLockup() {
  // Estimate wordmark width the same way og-image.mjs does (avgCharWidth =
  // fontSize * 0.56), since SVG <text> has no layout-time width in this
  // pipeline — verified against the actual render in the --proof step.
  const word = 'Vacationist';
  const avgCharWidth = WORD_FONT_SIZE * 0.56;
  const wordWidth = word.length * avgCharWidth + WORD_LETTER_SPACING * (word.length - 1);

  const totalWidth = MARK_SIZE + GAP + wordWidth;
  const startX = SAFE_CX - totalWidth / 2;
  const markX = startX;
  const markY = SAFE_CY - MARK_SIZE / 2;
  const textX = startX + MARK_SIZE + GAP;
  const textY = SAFE_CY + WORD_FONT_SIZE * 0.34; // visually centre a cap-height glyph on SAFE_CY

  return `
    <g transform="translate(${markX}, ${markY}) scale(${MARK_SCALE})">
      ${logoMark(0, 0)}
    </g>
    <text x="${textX}" y="${textY}" font-family="${FONT}" font-size="${WORD_FONT_SIZE}"
          font-weight="700" letter-spacing="${WORD_LETTER_SPACING}" fill="#690F0C">Vacationist</text>`;
}

function stackedLockup() {
  const word = 'Vacationist';
  const wordFontSize = 140;
  const avgCharWidth = wordFontSize * 0.56;
  const wordWidth = word.length * avgCharWidth + WORD_LETTER_SPACING * (word.length - 1);
  const vGap = 46;

  const markSize = 260;
  const markScale = markSize / MARK_SRC;
  const totalHeight = markSize + vGap + wordFontSize;
  const topY = SAFE_CY - totalHeight / 2;

  const markX = SAFE_CX - markSize / 2;
  const markY = topY;
  const textX = SAFE_CX - wordWidth / 2;
  const textY = topY + markSize + vGap + wordFontSize * 0.78;

  return `
    <g transform="translate(${markX}, ${markY}) scale(${markScale})">
      ${logoMark(0, 0)}
    </g>
    <text x="${textX}" y="${textY}" font-family="${FONT}" font-size="${wordFontSize}"
          font-weight="700" letter-spacing="${WORD_LETTER_SPACING}" fill="#690F0C">Vacationist</text>`;
}

const lockup = variant === 'stacked' ? stackedLockup() : horizontalLockup();

/* ── Bleed motifs (route lines, pins, planes, dot grid) — croppable ────── */

function dotGrid() {
  const rows = 10;
  const cols = 22;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = 90 + col * (W / cols);
      const y = 80 + row * (H / rows);
      const opacity = (0.05 + Math.sin(col + row) * 0.02).toFixed(3);
      cells.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#690F0C" opacity="${opacity}"/>`);
    }
  }
  return cells.join('');
}

const bleedMotifs = `
  ${dotGrid()}
  <!-- Dashed route lines -->
  <line x1="260"  y1="300"  x2="820"  y2="560"  stroke="#8c6196" stroke-width="2" opacity="0.22" stroke-dasharray="18 10"/>
  <line x1="3020" y1="420"  x2="3620" y2="1260" stroke="#8c6196" stroke-width="2" opacity="0.22" stroke-dasharray="18 10"/>
  <line x1="220"  y1="1340" x2="760"  y2="1080" stroke="#E08A25" stroke-width="2" opacity="0.20" stroke-dasharray="14 10"/>
  <line x1="3180" y1="1480" x2="3700" y2="1180" stroke="#E08A25" stroke-width="2" opacity="0.20" stroke-dasharray="14 10"/>

  <!-- Map pins -->
  <g transform="translate(300, 260)" opacity="0.38">
    <circle cx="0" cy="-14" r="20" fill="#8c6196"/>
    <path d="M-8,0 Q0,30 0,30 Q0,30 8,0 Z" fill="#8c6196"/>
    <circle cx="0" cy="-14" r="8" fill="#FECE8A"/>
  </g>
  <g transform="translate(3560, 1400)" opacity="0.34">
    <circle cx="0" cy="-14" r="20" fill="#E08A25"/>
    <path d="M-8,0 Q0,30 0,30 Q0,30 8,0 Z" fill="#E08A25"/>
    <circle cx="0" cy="-14" r="8" fill="#FECE8A"/>
  </g>
  <g transform="translate(250, 1500)" opacity="0.26">
    <circle cx="0" cy="-10" r="13" fill="#8c6196"/>
    <path d="M-5,0 Q0,19 0,19 Q0,19 5,0 Z" fill="#8c6196"/>
    <circle cx="0" cy="-10" r="5" fill="#FECE8A"/>
  </g>

  <!-- Paper-plane glyphs -->
  <g transform="translate(3460, 260) rotate(-30) scale(2.6)" opacity="0.28">
    <path d="M0,0 L28,-7 L22,0 L28,7 Z" fill="#8c6196"/>
    <path d="M4,-2 L-10,-18 L-15,-15 L-2,-2 Z" fill="#8c6196" opacity="0.75"/>
    <path d="M4,2  L-10,18  L-15,15  L-2,2  Z" fill="#8c6196" opacity="0.75"/>
    <rect x="-18" y="-1" width="8" height="2" rx="1" fill="#8c6196"/>
  </g>
  <g transform="translate(360, 1180) rotate(16) scale(1.7)" opacity="0.22">
    <path d="M0,0 L28,-7 L22,0 L28,7 Z" fill="#E08A25"/>
    <path d="M4,-2 L-10,-18 L-15,-15 L-2,-2 Z" fill="#E08A25" opacity="0.75"/>
    <path d="M4,2  L-10,18  L-15,15  L-2,2  Z" fill="#E08A25" opacity="0.75"/>
    <rect x="-18" y="-1" width="8" height="2" rx="1" fill="#E08A25"/>
  </g>`;

/* ── Compose ────────────────────────────────────────────────────────────── */

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${brandDefs()}
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#F08A2E"/>
      <stop offset="55%"  stop-color="#FDA444"/>
      <stop offset="100%" stop-color="#FECE8A"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${bleedMotifs}
  ${lockup}
  <rect x="${SAFE_CX - (variant === 'stacked' ? 170 : 380)}" y="${
    variant === 'stacked' ? SAFE_CY + 210 : SAFE_CY + 96
  }" width="${variant === 'stacked' ? 340 : 760}" height="6" rx="3" fill="#8c6196" opacity="0.9"/>
</svg>`;

console.log(`Rendering SVG → PNG (variant: ${variant}) …`);
const pipeline = sharp(Buffer.from(svg)).flatten({ background: '#FDA444' }).png({
  compressionLevel: 9,
  adaptiveFiltering: false,
});

await pipeline.toFile(OUT_FILE);

const meta = await sharp(OUT_FILE).metadata();
console.log(`Done: ${OUT_FILE}`);
console.log(`  ${meta.width}x${meta.height}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`);

if (proof) {
  const scratchDir = process.env.APPSTORE_PROOF_DIR;
  if (!scratchDir) {
    console.warn('--proof requested but APPSTORE_PROOF_DIR is not set — skipping proof renders.');
  } else {
    mkdirSync(scratchDir, { recursive: true });

    // Safe-area overlay
    const overlaySvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${SAFE.left}" y="${SAFE.top}" width="${SAFE_W}" height="${SAFE_H}"
            fill="none" stroke="#00FF00" stroke-width="6" stroke-dasharray="20 12"/>
    </svg>`;
    await sharp(OUT_FILE)
      .composite([{ input: Buffer.from(overlaySvg) }])
      .png()
      .toFile(resolve(scratchDir, `safe-area-overlay-${variant}.png`));

    // Crop simulations: progressively narrower centred windows at full height,
    // then the exact safe box itself.
    const widths = [3000, 2400, 2000];
    for (const w of widths) {
      const left = Math.round(W / 2 - w / 2);
      await sharp(OUT_FILE)
        .extract({ left, top: 0, width: w, height: H })
        .png()
        .toFile(resolve(scratchDir, `crop-${w}w-${variant}.png`));
    }
    await sharp(OUT_FILE)
      .extract({ left: SAFE.left, top: SAFE.top, width: SAFE_W, height: SAFE_H })
      .png()
      .toFile(resolve(scratchDir, `crop-safe-box-${variant}.png`));

    console.log(`Proof renders written to: ${scratchDir}`);
  }
}
