/**
 * Generates the Product Hunt gallery for the Phase 3 launch (Growth Plan Q4 2026):
 *   - 6 gallery cards at 1270×760 (PH's recommended gallery size)
 *   - 1 thumbnail at 240×240 (PH's recommended thumbnail size)
 * Output: social-media/product-hunt/ph-gallery-0N-<slug>.png + ph-thumbnail.png
 *
 * Cards are a branded SVG background (same palette as marketing/site/og-image.mjs and
 * scripts/generate-play-header.mjs) with the Greece device screenshots composited on top in
 * a rounded phone frame. og-image.mjs can't be parameterised for this — its canvas is a
 * 1200×630 module constant and it has no <image> support — so this is a sibling script.
 *
 * Source screenshots: play-store/screenshots/screenshot_greece_*.jpg (1080×2460 device captures
 * incl. Android chrome). The crop/frame logic lives in scripts/lib/phoneFrame.mjs, shared with
 * generate-producthunt-video.mjs; its CONTENT_TOP/BOTTOM crop is identical to
 * generate-ios-screenshots.mjs and generate-web-screenshots.mjs — keep them in sync.
 *
 * Product Hunt limits verified 2026-09-18 (help.producthunt.com "How to post a product"):
 * gallery 1270×760 (2–8 images), thumbnail 240×240, every image under 3 MB. This script fails
 * loudly if any output is over the cap.
 *
 * Run from repo root:  node scripts/generate-producthunt-assets.mjs   (npm run assets:producthunt)
 */

import sharp from 'sharp';
import { mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { phoneLayer, clipToCanvas } from './lib/phoneFrame.mjs';
import { FONT, escXml, logoMark, brandDefs, wrap } from './lib/brandSvg.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ICON_PATH = resolve(__dir, '../apps/mobile/assets/images/icon.png');
const OUT_DIR = resolve(__dir, '../social-media/product-hunt');

const W = 1270;
const H = 760;
const MAX_BYTES = 3 * 1024 * 1024;


/* ── SVG pieces ──────────────────────────────────────────────────────────── */

function lockup(x, y) {
  return `${logoMark(x, y)}
  <text x="${x + 58}" y="${y + 30}" font-family="${FONT}" font-size="24" font-weight="700" letter-spacing="-0.5" fill="#F2F2F2">Vacationist</text>`;
}

function defs(glowX, glowY, glowColor) {
  return `<defs>
    <radialGradient id="bg-glow" cx="${glowX}" cy="${glowY}" r="55%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.50"/>
      <stop offset="100%" stop-color="#0F0F0F" stop-opacity="0"/>
    </radialGradient>
    ${brandDefs()}
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>`;
}

function background(glowX, glowY, glowColor) {
  // Sparse dot grid, same idea as the Play header — texture without competing with the phone.
  const dots = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 14; col++) {
      const opacity = (0.05 + Math.sin(col * 1.3 + row) * 0.025).toFixed(3);
      dots.push(`<circle cx="${60 + col * 96}" cy="${50 + row * 100}" r="2" fill="#8A84FF" opacity="${opacity}"/>`);
    }
  }
  return `<rect width="${W}" height="${H}" fill="#0F0F0F"/>
  <rect width="${W}" height="${H}" fill="url(#bg-glow)"/>
  ${dots.join('')}`;
}

/** Soft drop shadow under a phone, drawn into the background so it never needs a layer. */
function phoneShadow(left, top, ow, oh, radius) {
  return `<rect x="${left}" y="${top + 28}" width="${ow}" height="${oh}" rx="${radius}" fill="#000" opacity="0.6" filter="url(#shadow)"/>`;
}

/**
 * Eyebrow pill + headline (last line in the brand gradient) + sub-copy, vertically centred.
 * Headline size auto-fits the longest hand-broken line to `maxW`.
 */
function textBlock({ x, maxW, eyebrow, accent, headline, sub, subSize = 26 }) {
  const longest = Math.max(...headline.map((l) => l.length));
  const hSize = Math.min(62, Math.floor(maxW / (longest * 0.56)));
  const hLine = Math.round(hSize * 1.18);
  const subLines = wrap(sub, subSize, maxW);
  const subLine = Math.round(subSize * 1.45);

  const pillH = 36;
  const gap1 = 34;
  const gap2 = 26;
  const total = pillH + gap1 + headline.length * hLine + gap2 + subLines.length * subLine;
  const top = Math.max(130, Math.round(410 - total / 2));

  const pillW = Math.round(eyebrow.length * 12.4 + 38);
  const hTop = top + pillH + gap1;
  const sTop = hTop + headline.length * hLine + gap2;

  const headSvg = headline
    .map((line, i) => {
      const last = i === headline.length - 1;
      return `<text x="${x}" y="${hTop + Math.round(hSize * 0.88) + i * hLine}" font-family="${FONT}" font-size="${hSize}" font-weight="800" letter-spacing="-1.5" fill="${last ? 'url(#hl)' : '#F2F2F2'}">${escXml(line)}</text>`;
    })
    .join('\n  ');
  const subSvg = subLines
    .map((line, i) => `<text x="${x}" y="${sTop + Math.round(subSize * 0.9) + i * subLine}" font-family="${FONT}" font-size="${subSize}" font-weight="400" fill="#A8A8B3">${escXml(line)}</text>`)
    .join('\n  ');

  return `<rect x="${x}" y="${top}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"/>
  <text x="${x + pillW / 2}" y="${top + 24}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" letter-spacing="2.4" fill="${accent}">${escXml(eyebrow)}</text>
  ${headSvg}
  ${subSvg}`;
}

const footer = (x, anchor = 'start') =>
  `<text x="${x}" y="${H - 38}" text-anchor="${anchor}" font-family="${FONT}" font-size="20" font-weight="500" fill="#5C5C5C">vacationist.app</text>`;

/* ── Cards ───────────────────────────────────────────────────────────────── */

async function renderCard(svg, phones) {
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const overlays = [];
  for (const p of phones) overlays.push({ input: await clipToCanvas(p.layer, p.top, H), left: p.left, top: p.top });
  return sharp(base).composite(overlays).png({ compressionLevel: 9 }).toBuffer();
}

/** One-phone card; the phone sits on `side` and bleeds off the bottom, text fills the other side. */
async function screenCard({ file, side, accent, eyebrow, headline, sub }) {
  const layer = await phoneLayer(file, 372);
  const top = 70;
  const phoneLeft = side === 'right' ? 760 : 110;
  const textX = side === 'right' ? 90 : 610;
  const glowX = side === 'right' ? '72%' : '28%';

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs(glowX, '46%', accent)}
  ${background()}
  ${phoneShadow(phoneLeft, top, layer.width, layer.height, layer.radius)}
  ${lockup(textX, 52)}
  ${textBlock({ x: textX, maxW: 580, eyebrow, accent, headline, sub })}
  ${footer(textX)}
</svg>`;
  return renderCard(svg, [{ layer, left: phoneLeft, top }]);
}

async function heroCard() {
  const accent = '#8A84FF';
  const left = await phoneLayer('screenshot_greece_activities.jpg', 270, 0.84);
  const right = await phoneLayer('screenshot_greece_transfer_flights.jpg', 270, 0.84);
  const center = await phoneLayer('screenshot_greece_expenses_settlements.jpg', 300);

  const placements = [
    { layer: left, left: 450, top: 224 },
    { layer: right, left: 940, top: 224 },
    { layer: center, left: 690, top: 140 }, // last = on top
  ];

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs('70%', '52%', '#4B41D9')}
  ${background()}
  ${placements.map((p) => phoneShadow(p.left, p.top, p.layer.width, p.layer.height, p.layer.radius)).join('\n  ')}
  ${lockup(90, 52)}
  ${textBlock({
    x: 90,
    maxW: 350,
    eyebrow: 'FREE GROUP TRIP PLANNER',
    accent,
    headline: ['Plan trips', 'together,', 'effortlessly.'],
    sub: 'Vote on activities, split costs, stay in sync.',
    subSize: 23,
  })}
  ${footer(90)}
</svg>`;
  return renderCard(svg, placements);
}

function trustCard() {
  const tiles = [
    ['No account to join', "One invite link and you're in — guests can vote right away."],
    ['Works offline', 'Read the plan and keep planning for a week without signal.'],
    ['Encrypted documents', 'Passport details encrypted with AES-256, unlocked by biometrics.'],
    ['Built in Switzerland', 'iOS, Android and web — any group size.'],
  ];
  const tileW = 268;
  const tileH = 250;
  const gap = 22;
  const startX = Math.round((W - (tiles.length * tileW + (tiles.length - 1) * gap)) / 2);
  const tileY = 368;

  const tileSvg = tiles
    .map(([title, body], i) => {
      const x = startX + i * (tileW + gap);
      const lines = wrap(body, 19, tileW - 48);
      return `<g>
    <rect x="${x}" y="${tileY}" width="${tileW}" height="${tileH}" rx="20" fill="#17171d" stroke="#2c2c38" stroke-width="1.5"/>
    <circle cx="${x + 46}" cy="${tileY + 50}" r="20" fill="#6C63FF" fill-opacity="0.18" stroke="#6C63FF" stroke-opacity="0.6" stroke-width="1.5"/>
    <path d="M ${x + 37} ${tileY + 50} L ${x + 44} ${tileY + 57} L ${x + 56} ${tileY + 43}" stroke="#C4BDFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <text x="${x + 24}" y="${tileY + 106}" font-family="${FONT}" font-size="21" font-weight="700" fill="#F2F2F2">${escXml(title)}</text>
    ${lines.map((l, li) => `<text x="${x + 24}" y="${tileY + 142 + li * 27}" font-family="${FONT}" font-size="19" fill="#A8A8B3">${escXml(l)}</text>`).join('\n    ')}
  </g>`;
    })
    .join('\n  ');

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs('50%', '30%', '#4B41D9')}
  ${background()}
  ${lockup(90, 52)}
  <text x="${W / 2}" y="200" text-anchor="middle" font-family="${FONT}" font-size="66" font-weight="800" letter-spacing="-2" fill="#F2F2F2">Free. No ads.</text>
  <text x="${W / 2}" y="278" text-anchor="middle" font-family="${FONT}" font-size="66" font-weight="800" letter-spacing="-2" fill="url(#hl)">Works offline.</text>
  ${tileSvg}
  ${footer(W / 2, 'middle')}
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });

const cards = [
  ['01-hero', () => heroCard()],
  [
    '02-vote',
    () =>
      screenCard({
        file: 'screenshot_greece_activities.jpg',
        side: 'right',
        accent: '#8A84FF',
        eyebrow: 'GROUP VOTING',
        headline: ['Vote,', "don't argue."],
        sub: 'Suggest activities, let the whole group vote, and lock in what wins.',
      }),
  ],
  [
    '03-split',
    () =>
      screenCard({
        file: 'screenshot_greece_expenses_settlements.jpg',
        side: 'left',
        accent: '#3ECF8E',
        eyebrow: 'SPLIT EXPENSES',
        headline: ['Split every cost.', 'Know who owes what.'],
        sub: 'Simplified settlements, a spending breakdown and receipts attached to every expense.',
      }),
  ],
  [
    '04-flights',
    () =>
      screenCard({
        file: 'screenshot_greece_transfer_flights.jpg',
        side: 'right',
        accent: '#5EC8F2',
        eyebrow: 'FLIGHTS & TRANSFERS',
        headline: ['Flights & tickets,', 'kept with the trip.'],
        sub: 'Compare options, vote, then book — and everyone’s ticket lives in one place.',
      }),
  ],
  [
    '05-calendar',
    () =>
      screenCard({
        file: 'screenshot_greece_calendar.jpg',
        side: 'left',
        accent: '#F5A623',
        eyebrow: 'SHARED CALENDAR',
        headline: ['The whole trip,', 'day by day.'],
        sub: 'See what’s planned, when, and who’s joining — all in one shared calendar.',
      }),
  ],
  ['06-trust', () => trustCard()],
];

console.log(`Rendering ${cards.length} gallery cards at ${W}×${H} …`);
const outputs = [];
for (const [slug, render] of cards) {
  const outPath = resolve(OUT_DIR, `ph-gallery-${slug}.png`);
  await sharp(await render()).toFile(outPath);
  outputs.push(outPath);
}

console.log('Rendering 240×240 thumbnail …');
const thumbPath = resolve(OUT_DIR, 'ph-thumbnail.png');
await sharp(ICON_PATH).resize(240, 240).png({ compressionLevel: 9 }).toFile(thumbPath);
outputs.push(thumbPath);

let failed = false;
for (const p of outputs) {
  const bytes = statSync(p).size;
  const meta = await sharp(p).metadata();
  const over = bytes > MAX_BYTES;
  if (over) failed = true;
  console.log(
    `  ${p.split(/[\\/]/).pop()}  ${meta.width}×${meta.height}  ${(bytes / 1024).toFixed(0)} KB${over ? '  ← OVER 3 MB CAP' : ''}`,
  );
}
if (failed) {
  console.error('One or more assets exceed Product Hunt’s 3 MB limit.');
  process.exit(1);
}
console.log('Done.');
