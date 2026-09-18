/**
 * Generates the ~60-second Product Hunt demo video (Growth Plan Q4 2026, Phase 3).
 * 1920×1080 (16:9 — Product Hunt takes a YouTube URL, not an upload), 30 fps, no audio.
 *
 * Motion graphics built from the Greece device screenshots and brand SVG: every frame is an
 * SVG scene rasterised by sharp, the phones composited on top. Follows the recipe in
 * .claude/skills/reddit-ad-creatives/SKILL.md (animated SVG → frames → ffmpeg libx264) but,
 * unlike those Reddit creatives, the generator is committed so the video can be re-rendered
 * when the product or copy changes.
 *
 * ffmpeg is NOT installed on this machine and is not a repo dependency. Either pass
 * --ffmpeg=<path> (e.g. from `npm i ffmpeg-static` in a scratch dir) to encode here, or run
 * the command this script prints once the frames are rendered.
 *
 * Usage (repo root):
 *   node scripts/generate-producthunt-video.mjs --only=60,200,420      # inspect single frames
 *   node scripts/generate-producthunt-video.mjs --ffmpeg=<path>        # full render + encode
 *   node scripts/generate-producthunt-video.mjs                        # frames only, prints ffmpeg cmd
 *   --frames-dir=<dir>  where frames go (default: <os tmp>/vacationist-ph-frames)
 *   --keep-frames       don't delete the frames after a successful encode
 *
 * Output: social-media/product-hunt/vacationist-product-hunt-demo.mp4
 *
 * Every product claim on screen is one the site already makes (see marketing/site/content/
 * features/offline.md and the homepage TL;DR) — keep it that way when editing copy.
 */

import sharp from 'sharp';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { phoneLayer, clipToCanvas } from './lib/phoneFrame.mjs';
import { FONT, escXml, logoMark, brandDefs, wrap } from './lib/brandSvg.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dir, '../social-media/product-hunt');
const OUT_FILE = resolve(OUT_DIR, 'vacationist-product-hunt-demo.mp4');

const W = 1920;
const H = 1080;
const FPS = 30;
const PHONE_W = 420;

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FRAMES_DIR = resolve(arg('frames-dir') ?? resolve(tmpdir(), 'vacationist-ph-frames'));
const FFMPEG = arg('ffmpeg');
const ONLY = arg('only')?.split(',').map((n) => parseInt(n, 10));
const KEEP = process.argv.includes('--keep-frames');

/* ── Motion helpers ──────────────────────────────────────────────────────── */

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const seg = (t, start, dur) => clamp((t - start) / dur);
/** 0→1 fade/slide in at scene start, 1→0 at scene end. */
const vis = (t, dur, inD = 0.6, outD = 0.5) => Math.min(easeOut(t / inD), easeOut((dur - t) / outD));

/* ── SVG text/shape helpers ──────────────────────────────────────────────── */

function text(x, y, str, { size = 40, weight = 400, fill = '#F2F2F2', anchor = 'start', opacity = 1, dy = 0, ls = 0 } = {}) {
  if (opacity <= 0.001) return '';
  return `<text x="${x}" y="${y + dy}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}" opacity="${opacity.toFixed(3)}">${escXml(str)}</text>`;
}

function pill(x, y, label, color, opacity = 1) {
  if (opacity <= 0.001) return '';
  const w = Math.round(label.length * 12.6 + 40);
  return `<g opacity="${opacity.toFixed(3)}">
    <rect x="${x}" y="${y}" width="${w}" height="42" rx="21" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.55" stroke-width="1.5"/>
    <text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="700" letter-spacing="2.6" fill="${color}">${escXml(label)}</text>
  </g>`;
}

/** Eyebrow + two-line headline (2nd line gradient) + wrapped sub, fading/sliding in with `v`. */
function textBlock({ x, maxW, eyebrow, color, lines, sub, v }) {
  const dy = (1 - v) * 40;
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(104, Math.floor(maxW / (longest * 0.56)));
  const lh = Math.round(size * 1.16);
  const subLines = wrap(sub, 40, maxW, 0.5);
  const PILL_H = 42;
  const PILL_GAP = 40; // pill bottom -> top of the headline's capitals
  const SUB_GAP = 86; // last headline baseline -> first sub baseline (clears descenders)
  const capH = Math.round(size * 0.78);
  const total = PILL_H + PILL_GAP + capH + (lines.length - 1) * lh + SUB_GAP + (subLines.length - 1) * 58;
  const top = Math.round((H - total) / 2);
  const headY = top + PILL_H + PILL_GAP + capH;
  const subY = headY + (lines.length - 1) * lh + SUB_GAP;
  return [
    pill(x, top, eyebrow, color, v),
    ...lines.map((l, i) => text(x, headY + i * lh, l, { size, weight: 800, ls: -2, fill: i === lines.length - 1 ? 'url(#hl)' : '#F2F2F2', opacity: v, dy })),
    ...subLines.map((l, i) => text(x, subY + i * 58, l, { size: 40, fill: '#A8A8B3', opacity: v, dy })),
  ].join('\n');
}

const CIRCLE_COLORS = ['#6C63FF', '#3ECF8E', '#F5A623', '#5EC8F2'];

/* ── Scenes ──────────────────────────────────────────────────────────────── */

const RIGHT_PHONE = { left: 1260, top: Math.round((H - (Math.round((PHONE_W * 2196) / 1080) + 20)) / 2) };
const LEFT_PHONE = { left: 220, top: RIGHT_PHONE.top };

const scenes = [
  {
    id: 'hook',
    dur: 5,
    glow: ['50%', '45%', '#3a2a8a'],
    overlay: (t, d) => {
      const out = easeOut((d - t) / 0.5);
      const line = (i, str, start, y) => {
        const p = easeOut(seg(t, start, 0.6));
        return text(W / 2, y, str, { size: 88, weight: 800, ls: -2, anchor: 'middle', opacity: p * out, dy: (1 - p) * 34 });
      };
      return [
        line(0, 'Polls in one chat.', 0.3, 400),
        line(1, 'Expenses in another app.', 1.3, 520),
        line(2, 'The plan in a spreadsheet.', 2.3, 640),
        text(W / 2, 780, 'Sound familiar?', { size: 46, weight: 600, fill: '#8A84FF', anchor: 'middle', opacity: easeOut(seg(t, 3.5, 0.6)) * out }),
      ].join('\n');
    },
  },
  {
    id: 'brand',
    dur: 5,
    glow: ['50%', '42%', '#4B41D9'],
    overlay: (t, d) => {
      const out = easeOut((d - t) / 0.5);
      const p = easeOut(seg(t, 0.1, 0.9));
      const sc = (0.6 + 0.4 * p) * 3.2;
      return [
        `<g opacity="${(p * out).toFixed(3)}" transform="translate(${W / 2}, 380) scale(${sc.toFixed(3)}) translate(-22, -22)">${logoMark(0, 0)}</g>`,
        text(W / 2, 610, 'Vacationist', { size: 132, weight: 800, ls: -3, anchor: 'middle', opacity: easeOut(seg(t, 0.7, 0.6)) * out, dy: (1 - easeOut(seg(t, 0.7, 0.6))) * 30 }),
        text(W / 2, 705, 'The free group trip planner.', { size: 52, fill: '#A8A8B3', anchor: 'middle', opacity: easeOut(seg(t, 1.4, 0.6)) * out }),
      ].join('\n');
    },
  },
  {
    id: 'join',
    dur: 9,
    glow: ['70%', '50%', '#4B41D9'],
    overlay: (t, d) => {
      const v = vis(t, d);
      const out = easeOut((d - t) / 0.5);
      const initials = ['G', 'J', 'S', 'A'];
      const names = ['Gabriel', 'Julia', 'Sarah', 'Alex'];
      const linkP = easeOut(seg(t, 0.9, 0.6));
      const avatars = initials.map((ch, i) => {
        const p = easeOut(seg(t, 2.2 + i * 0.5, 0.45));
        const cx = 1130 + i * 160;
        return `<g opacity="${(p * out).toFixed(3)}" transform="translate(${cx}, 580) scale(${(0.4 + 0.6 * p).toFixed(3)})">
          <circle r="64" fill="${CIRCLE_COLORS[i]}" fill-opacity="0.22" stroke="${CIRCLE_COLORS[i]}" stroke-width="3"/>
          <text y="20" text-anchor="middle" font-family="${FONT}" font-size="56" font-weight="800" fill="#F2F2F2">${ch}</text>
        </g>
        ${text(cx, 690, names[i], { size: 28, fill: '#A8A8B3', anchor: 'middle', opacity: p * out })}`;
      });
      return [
        text(170, 440, 'One link.', { size: 108, weight: 800, ls: -2.5, opacity: v, dy: (1 - v) * 40 }),
        text(170, 560, 'Everyone in.', { size: 108, weight: 800, ls: -2.5, fill: 'url(#hl)', opacity: v, dy: (1 - v) * 40 }),
        text(170, 650, 'Guests join without creating an account.', { size: 40, fill: '#A8A8B3', opacity: v }),
        `<g opacity="${(linkP * out).toFixed(3)}">
          <rect x="1030" y="340" width="720" height="92" rx="46" fill="#17171d" stroke="#4a4a6a" stroke-width="2"/>
          <text x="1390" y="398" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="600" fill="#C4BDFF">vacationist.app/join?token=…</text>
        </g>`,
        ...avatars,
        text(1390, 800, '4 people joined', { size: 40, weight: 700, fill: '#3ECF8E', anchor: 'middle', opacity: easeOut(seg(t, 4.6, 0.6)) * out }),
      ].join('\n');
    },
  },
  {
    id: 'vote',
    dur: 11,
    glow: ['75%', '50%', '#4B41D9'],
    phone: { file: 'screenshot_greece_activities.jpg', ...RIGHT_PHONE },
    overlay: (t, d) => {
      const v = vis(t, d);
      // Pulsing ring on the "Vote" chip (position measured from the source screenshot).
      const ringOn = easeOut(seg(t, 3.5, 0.5)) * easeOut((d - t) / 0.5);
      const cx = RIGHT_PHONE.left + 10 + 0.461 * PHONE_W;
      const cy = RIGHT_PHONE.top + 10 + 0.3816 * Math.round((PHONE_W * 2196) / 1080);
      const pulse = (Math.sin(t * 5) + 1) / 2;
      return [
        textBlock({ x: 170, maxW: 940, eyebrow: 'GROUP VOTING', color: '#8A84FF', lines: ['Vote,', "don't argue."], sub: 'Suggest activities. The whole group votes. What wins gets locked in.', v }),
        ringOn > 0.01
          ? `<rect x="${(cx - 58 - pulse * 6).toFixed(1)}" y="${(cy - 26 - pulse * 5).toFixed(1)}" width="${(116 + pulse * 12).toFixed(1)}" height="${(52 + pulse * 10).toFixed(1)}" rx="${(26 + pulse * 5).toFixed(1)}" fill="none" stroke="#3ECF8E" stroke-width="5" opacity="${(ringOn * (0.95 - pulse * 0.5)).toFixed(3)}"/>`
          : '',
      ].join('\n');
    },
  },
  {
    id: 'split',
    dur: 10,
    glow: ['25%', '50%', '#1f7a52'],
    phone: { file: 'screenshot_greece_expenses_settlements.jpg', ...LEFT_PHONE },
    overlay: (t, d) => {
      const v = vis(t, d);
      const chip = easeOut(seg(t, 4.2, 0.6)) * easeOut((d - t) / 0.5);
      return [
        textBlock({ x: 800, maxW: 1000, eyebrow: 'SPLIT EXPENSES', color: '#3ECF8E', lines: ['Split every cost.', 'Know who owes what.'], sub: 'Simplified settlements, a spending breakdown and receipts attached.', v }),
        chip > 0.01
          ? `<g opacity="${chip.toFixed(3)}" transform="translate(0, ${((1 - chip) * 20).toFixed(1)})">
              <rect x="800" y="850" width="470" height="72" rx="36" fill="#3ECF8E" fill-opacity="0.16" stroke="#3ECF8E" stroke-opacity="0.6" stroke-width="2"/>
              <text x="1035" y="898" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="700" fill="#3ECF8E">2 payments settle it all</text>
            </g>`
          : '',
      ].join('\n');
    },
  },
  {
    id: 'flights',
    dur: 8,
    glow: ['75%', '50%', '#1f6f8a'],
    phone: { file: 'screenshot_greece_transfer_flights.jpg', ...RIGHT_PHONE },
    overlay: (t, d) =>
      textBlock({ x: 170, maxW: 1000, eyebrow: 'FLIGHTS & TRANSFERS', color: '#5EC8F2', lines: ['Flights & tickets,', 'kept with the trip.'], sub: 'Compare options, vote, then book — and everyone’s ticket lives in one place.', v: vis(t, d) }),
  },
  {
    id: 'offline',
    dur: 7,
    glow: ['50%', '55%', '#4B41D9'],
    overlay: (t, d) => {
      const v = vis(t, d);
      const out = easeOut((d - t) / 0.5);
      const SYNC_AT = 3.6;
      const online = t >= SYNC_AT;
      const rows = [
        ['Expense added', 'Dinner, €48.00'],
        ['Vote cast', 'Wine Tasting'],
        ['Item ticked off', 'Sunscreen'],
      ];
      const rowSvg = rows.map(([a, b], i) => {
        const p = easeOut(seg(t, 0.9 + i * 0.35, 0.5)) * out;
        const y = 520 + i * 118;
        const syncedAt = SYNC_AT + i * 0.45;
        const synced = t >= syncedAt;
        const flip = easeOut(seg(t, syncedAt, 0.3));
        const stateColor = synced ? '#3ECF8E' : '#F5A623';
        const label = synced ? 'Synced' : 'Queued';
        return `<g opacity="${p.toFixed(3)}">
          <rect x="480" y="${y}" width="960" height="92" rx="20" fill="#1d1d26" stroke="#2c2c38" stroke-width="1.5"/>
          <text x="520" y="${y + 40}" font-family="${FONT}" font-size="32" font-weight="700" fill="#F2F2F2">${escXml(a)}</text>
          <text x="520" y="${y + 74}" font-family="${FONT}" font-size="26" fill="#A8A8B3">${escXml(b)}</text>
          <rect x="1200" y="${y + 22}" width="200" height="48" rx="24" fill="${stateColor}" fill-opacity="${(0.16 + 0.06 * flip).toFixed(3)}" stroke="${stateColor}" stroke-opacity="0.65" stroke-width="2"/>
          <text x="1300" y="${y + 54}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="${stateColor}">${label}</text>
        </g>`;
      });
      const statusColor = online ? '#3ECF8E' : '#F0616D';
      return [
        text(W / 2, 250, 'Works offline.', { size: 124, weight: 800, ls: -3, fill: 'url(#hl)', anchor: 'middle', opacity: v, dy: (1 - v) * 40 }),
        text(W / 2, 335, 'Keep planning for a week without signal.', { size: 46, fill: '#A8A8B3', anchor: 'middle', opacity: v }),
        `<g opacity="${(easeOut(seg(t, 0.6, 0.5)) * out).toFixed(3)}">
          <rect x="480" y="410" width="${online ? 240 : 230}" height="64" rx="32" fill="${statusColor}" fill-opacity="0.16" stroke="${statusColor}" stroke-opacity="0.65" stroke-width="2"/>
          <circle cx="516" cy="442" r="10" fill="${statusColor}"/>
          <text x="540" y="453" font-family="${FONT}" font-size="30" font-weight="700" fill="${statusColor}">${online ? 'Back online' : 'No signal'}</text>
        </g>`,
        ...rowSvg,
        text(W / 2, 950, online ? 'Everything syncs on its own.' : 'Changes are saved on your phone.', { size: 44, weight: 600, fill: online ? '#3ECF8E' : '#A8A8B3', anchor: 'middle', opacity: easeOut(seg(t, 1.8, 0.6)) * out }),
      ].join('\n');
    },
  },
  {
    id: 'end',
    dur: 5,
    glow: ['50%', '45%', '#4B41D9'],
    overlay: (t, d) => {
      const out = t > d - 0.35 ? easeOut((d - t) / 0.35) : 1; // hold to the last frame
      const p = easeOut(seg(t, 0.1, 0.8));
      return [
        `<g opacity="${(p * out).toFixed(3)}" transform="translate(${W / 2}, 300) scale(${((0.7 + 0.3 * p) * 2.6).toFixed(3)}) translate(-22, -22)">${logoMark(0, 0)}</g>`,
        text(W / 2, 530, 'Vacationist', { size: 120, weight: 800, ls: -3, anchor: 'middle', opacity: easeOut(seg(t, 0.5, 0.6)) * out }),
        text(W / 2, 650, 'Free. No ads.', { size: 76, weight: 800, ls: -1.5, fill: 'url(#hl)', anchor: 'middle', opacity: easeOut(seg(t, 1.1, 0.6)) * out }),
        text(W / 2, 730, 'iOS · Android · Web', { size: 46, fill: '#A8A8B3', anchor: 'middle', opacity: easeOut(seg(t, 1.6, 0.6)) * out }),
        text(W / 2, 860, 'vacationist.app', { size: 60, weight: 700, anchor: 'middle', opacity: easeOut(seg(t, 2.1, 0.6)) * out }),
      ].join('\n');
    },
  },
];

const TOTAL_FRAMES = scenes.reduce((n, s) => n + s.dur * FPS, 0);

/* ── Rendering ───────────────────────────────────────────────────────────── */

function backgroundSvg([gx, gy, gc]) {
  const dots = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 20; col++) {
      const o = (0.05 + Math.sin(col * 1.3 + row) * 0.025).toFixed(3);
      dots.push(`<circle cx="${60 + col * 96}" cy="${50 + row * 100}" r="2.4" fill="#8A84FF" opacity="${o}"/>`);
    }
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="g" cx="${gx}" cy="${gy}" r="60%"><stop offset="0%" stop-color="${gc}" stop-opacity="0.5"/><stop offset="100%" stop-color="#0F0F0F" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="#0F0F0F"/><rect width="${W}" height="${H}" fill="url(#g)"/>${dots.join('')}
</svg>`;
}

const wrapOverlay = (inner) => `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>${brandDefs()}</defs>${inner}</svg>`;

console.log('Preparing backgrounds and phone layers …');
const bgBuffers = await Promise.all(scenes.map((s) => sharp(Buffer.from(backgroundSvg(s.glow))).png().toBuffer()));
const phoneCache = new Map();
for (const s of scenes) {
  if (s.phone && !phoneCache.has(s.phone.file)) phoneCache.set(s.phone.file, await phoneLayer(s.phone.file, PHONE_W));
}

function locate(frame) {
  let start = 0;
  for (let i = 0; i < scenes.length; i++) {
    const frames = scenes[i].dur * FPS;
    if (frame < start + frames) return { i, t: (frame - start) / FPS };
    start += frames;
  }
  return { i: scenes.length - 1, t: scenes[scenes.length - 1].dur };
}

async function renderFrame(frame) {
  const { i, t } = locate(frame);
  const scene = scenes[i];
  const layers = [];

  if (scene.phone) {
    const layer = phoneCache.get(scene.phone.file);
    const v = vis(t, scene.dur, 0.8, 0.5);
    const top = Math.round(scene.phone.top + (1 - v) * 320);
    const input = await clipToCanvas(layer, top, H);
    if (input && v > 0.005) layers.push({ input, left: scene.phone.left, top });
  }
  layers.push({ input: Buffer.from(wrapOverlay(scene.overlay(t, scene.dur))), left: 0, top: 0 });

  const file = resolve(FRAMES_DIR, `f${String(frame).padStart(4, '0')}.jpg`);
  await sharp(bgBuffers[i]).composite(layers).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(file);
}

mkdirSync(FRAMES_DIR, { recursive: true });
const frames = ONLY ?? Array.from({ length: TOTAL_FRAMES }, (_, n) => n);
console.log(`Rendering ${frames.length} of ${TOTAL_FRAMES} frames (${(TOTAL_FRAMES / FPS).toFixed(0)} s @ ${FPS} fps, ${W}×${H}) → ${FRAMES_DIR}`);

const CONCURRENCY = 6;
let next = 0;
let done = 0;
const startedAt = Date.now();
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < frames.length) {
      const frame = frames[next++];
      await renderFrame(frame);
      if (++done % 150 === 0) console.log(`  ${done}/${frames.length}  (${((Date.now() - startedAt) / 1000).toFixed(0)} s)`);
    }
  }),
);
console.log(`Rendered ${done} frame(s) in ${((Date.now() - startedAt) / 1000).toFixed(0)} s.`);

if (ONLY) {
  console.log('--only given: frames written, not encoding. Inspect:', FRAMES_DIR);
  process.exit(0);
}

/* ── Encode ──────────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });
const ffArgs = [
  '-y', '-framerate', String(FPS), '-start_number', '0', '-i', resolve(FRAMES_DIR, 'f%04d.jpg'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '18', '-movflags', '+faststart',
  OUT_FILE,
];

if (!FFMPEG) {
  console.log('\nNo --ffmpeg given. Encode with:\n');
  console.log(`  ffmpeg ${ffArgs.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}\n`);
  process.exit(0);
}

console.log('Encoding …');
const res = spawnSync(FFMPEG, ffArgs, { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('ffmpeg failed — frames kept in', FRAMES_DIR);
  process.exit(res.status ?? 1);
}
console.log(`Wrote ${OUT_FILE}`);
if (!KEEP && existsSync(FRAMES_DIR)) rmSync(FRAMES_DIR, { recursive: true, force: true });
