/**
 * Per-page social-preview (OG/Twitter) image generator.
 *
 * Renders a branded 1200×630 SVG card per content page and rasterizes it to
 * PNG with sharp. Visual tokens (colors, gradient, logo mark, font stack)
 * are lifted directly from the hand-designed docs/og-image.svg so generated
 * cards match the homepage's bespoke image without inventing a new visual
 * language.
 *
 * Cards are differentiated by page.type so a run of shared links (several
 * /vs/ pages, a /use-cases/ next to a /features/ page, ...) doesn't read as
 * "the same card with different words": each category gets its own glow
 * accent color and a large, low-opacity abstract watermark motif, and /vs/
 * comparison pages get an entirely different two-name composition instead
 * of the generic badge+title layout.
 *
 * The homepage itself (/ and /de/) keeps its existing bespoke og-image.png —
 * this module only covers markdown-driven content pages.
 */

import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const BADGE = {
  en: {
    comparison: 'COMPARISON', listicle: 'ALTERNATIVES', pillar: 'GUIDE',
    article: 'GUIDE', 'use-case': 'USE CASE', feature: 'FEATURE',
  },
  de: {
    comparison: 'VERGLEICH', listicle: 'ALTERNATIVEN', pillar: 'RATGEBER',
    article: 'RATGEBER', 'use-case': 'ANWENDUNGSFALL', feature: 'FUNKTION',
  },
};

// Background glow tint per category — same position/falloff as the original
// single-color glow, only the hue changes, so every card stays "dark and
// moody" rather than turning into a rainbow. `comparison` keeps the original
// purple since /vs/ pages differentiate via layout instead (see below).
const ACCENT = {
  comparison: '#2a1f6e',
  listicle: '#0f4c4c',
  pillar: '#4a3208',
  article: '#4a3208',
  'use-case': '#4a1030',
  feature: '#123d24',
};
const DEFAULT_ACCENT = '#2a1f6e';

const escXml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word-wrap using an estimated average character width — SVG <text>
 * has no native wrapping. Not pixel-perfect, but the width budget below is
 * conservative enough to keep every realistic title safely inside the card. */
function wrapText(text, fontSize, maxWidth) {
  const avgCharWidth = fontSize * 0.56;
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / avgCharWidth));
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Short, card-friendly headline — same fallback breadcrumbs() already uses
 * in build.mjs, so the OG card title matches the breadcrumb trail's label. */
function headlineFor(page) {
  return page.breadcrumbLabel || page.title.split(/[:|—|]/)[0].trim();
}

function titleBlock(headline) {
  const len = headline.length;
  const fontSize = len <= 20 ? 64 : len <= 35 ? 52 : 42;
  const lineHeight = Math.round(fontSize * 1.18);
  const lines = wrapText(headline, fontSize, 1000).slice(0, 3);
  const startY = 400 - Math.round(((lines.length - 1) * lineHeight) / 2);
  return lines.map((line, i) => (
    `<text x="100" y="${startY + i * lineHeight}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-1.5" fill="#F2F2F2">${escXml(line)}</text>`
  )).join('\n  ');
}

/* ── Category watermark motifs ──────────────────────────────────────────
 * Large (~300px footprint), low-opacity, abstract — kept in the right-side
 * glow zone (x ≳ 650) so they never compete with the left-anchored text
 * column. Rendered before the wordmark/title so text always paints on top. */

function motifListicle() {
  // Stacked, offset rounded rectangles — "layered cards"
  return `<g stroke="#5eead4" stroke-width="2" fill="none" opacity="0.14">
    <rect x="760" y="360" width="260" height="150" rx="20"/>
    <rect x="782" y="330" width="260" height="150" rx="20"/>
    <rect x="804" y="300" width="260" height="150" rx="20"/>
  </g>`;
}

function motifPillar() {
  // Concentric arcs — "guide / rings"
  return `<g stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.13">
    <circle cx="960" cy="340" r="60"/>
    <circle cx="960" cy="340" r="120"/>
    <circle cx="960" cy="340" r="180"/>
  </g>`;
}

function motifUseCase() {
  // Loose scatter of circles — "many kinds of trips"
  const dots = [
    [760, 200, 14], [860, 150, 22], [980, 210, 10], [1080, 170, 30],
    [820, 320, 18], [1000, 380, 26], [1110, 320, 12], [900, 460, 16],
  ];
  const circles = dots.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
  return `<g fill="#f472b6" opacity="0.13">${circles}</g>`;
}

function motifFeature() {
  // 3×3 grid of small squares — "modular features"
  const size = 46;
  const gap = 26;
  const originX = 830;
  const originY = 210;
  const squares = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      squares.push(`<rect x="${originX + col * (size + gap)}" y="${originY + row * (size + gap)}" width="${size}" height="${size}" rx="10"/>`);
    }
  }
  return `<g stroke="#34d399" stroke-width="2" fill="none" opacity="0.14">${squares.join('')}</g>`;
}

const MOTIF = {
  listicle: motifListicle,
  pillar: motifPillar,
  article: motifPillar,
  'use-case': motifUseCase,
  feature: motifFeature,
};

/* ── Shared background + wordmark ───────────────────────────────────── */

function defsAndBg(accent) {
  return `<defs>
    <radialGradient id="bg-glow" cx="72%" cy="38%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0F0F0F" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="logo-grad" cx="42%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#6C63FF"/>
      <stop offset="100%" stop-color="#18162D"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0F0F0F"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg-glow)"/>`;
}

function logoMark(x, y) {
  return `<g transform="translate(${x}, ${y})">
    <rect width="44" height="44" fill="url(#logo-grad)" rx="10"/>
    <path d="M 9 9 L 22 31 L 35 9" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="22" cy="31" r="4.5" fill="#6C63FF"/>
    <circle cx="22" cy="31" r="2" fill="#fff"/>
  </g>`;
}

const domainFooter = `<text x="100" y="580" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="20" font-weight="500" fill="#5C5C5C">vacationist.app</text>`;

/* ── Comparison ("Vacationist vs. X") composition ───────────────────── */

function comparisonSvg(page) {
  const headline = headlineFor(page);
  const competitor = headline.replace(/^vs\.?\s*/i, '').trim();
  const competitorFontSize = competitor.length <= 10 ? 58 : competitor.length <= 16 ? 46 : 36;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${defsAndBg(ACCENT.comparison)}

  ${logoMark(100, 70)}
  <text x="158" y="98" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="24" font-weight="700" letter-spacing="-0.5" fill="#F2F2F2">Vacationist</text>

  <text x="100" y="400" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="58" font-weight="800" letter-spacing="-1.5" fill="#8A84FF">Vacationist</text>

  <g transform="translate(438, 355)">
    <circle r="34" fill="#1A1A1A" stroke="#6C63FF" stroke-width="1.5"/>
    <text x="0" y="7" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="20" font-weight="800" letter-spacing="0.02em" fill="#8A84FF">VS</text>
  </g>

  <text x="510" y="400" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${competitorFontSize}" font-weight="700" letter-spacing="-1" fill="#A0A0A0">${escXml(competitor)}</text>

  ${domainFooter}
</svg>`;
}

/* ── Generic badge + title composition (everything else) ───────────── */

function genericSvg(page) {
  const lang = page.lang === 'de' ? 'de' : 'en';
  const badgeText = BADGE[lang][page.type];
  const headline = headlineFor(page);
  const accent = ACCENT[page.type] || DEFAULT_ACCENT;
  const motif = MOTIF[page.type] ? MOTIF[page.type]() : '';

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${defsAndBg(accent)}

  ${motif}

  <g transform="translate(100, 70)">
    ${logoMark(0, 0)}
    <text x="58" y="30" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="24" font-weight="700" letter-spacing="-0.5" fill="#F2F2F2">Vacationist</text>
  </g>

  ${badgeText ? `<g transform="translate(100, 200)">
    <rect width="${badgeText.length * 11 + 32}" height="34" rx="17" fill="rgba(108,99,255,0.16)" stroke="rgba(108,99,255,0.4)" stroke-width="1"/>
    <text x="16" y="23" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="14" font-weight="700" letter-spacing="0.08em" fill="#8A84FF">${escXml(badgeText)}</text>
  </g>` : ''}

  ${titleBlock(headline)}

  ${domainFooter}
</svg>`;
}

function ogImageSvg(page) {
  return page.type === 'comparison' ? comparisonSvg(page) : genericSvg(page);
}

/** PNG, 1200×630. Fixed encode options (no .withMetadata()) so output bytes
 * are deterministic across builds — required for the build's idempotency
 * invariant (same input must always produce byte-identical output). */
export async function generateOgImage(page) {
  const svg = ogImageSvg(page);
  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

export function ogImagePath(page) {
  return `${page.path.split('/').filter(Boolean).join('-')}.png`;
}
