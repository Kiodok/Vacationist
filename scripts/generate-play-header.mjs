/**
 * Generates the Google Play Console header image (Kopfzeilenbild).
 * Output: docs/play-store/header.png — 4096 × 2304 px
 *
 * Run from repo root:  node scripts/generate-play-header.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dir, '../play-store');
const OUT_FILE = resolve(OUT_DIR, 'header.png');

mkdirSync(OUT_DIR, { recursive: true });

const W = 4096;
const H = 2304;

// All measurements are in SVG units (1:1 with pixels at this viewBox).
const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Deep dark-to-purple gradient background -->
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#0D0B1F"/>
      <stop offset="55%"  stop-color="#0F0F0F"/>
      <stop offset="100%" stop-color="#0A0A14"/>
    </linearGradient>

    <!-- Purple accent gradient (buttons, underline, icon) -->
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#6C63FF"/>
      <stop offset="100%" stop-color="#9D97FF"/>
    </linearGradient>

    <!-- Glow radial — layered to avoid filter dependency -->
    <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#6C63FF" stop-opacity="0.22"/>
      <stop offset="60%"  stop-color="#6C63FF" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#6C63FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#9D97FF" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#9D97FF" stop-opacity="0"/>
    </radialGradient>

    <!-- App icon gradient -->
    <linearGradient id="iconGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#8A84FF"/>
      <stop offset="100%" stop-color="#5B52E0"/>
    </linearGradient>

    <!-- Soft shadow for icon -->
    <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#6C63FF" flood-opacity="0.35"/>
    </filter>

    <!-- Text glow -->
    <filter id="textGlow" x="-5%" y="-20%" width="110%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- ── Background ─────────────────────────────────────────── -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- ── Centre glow blob ───────────────────────────────────── -->
  <ellipse cx="${W / 2}" cy="${H * 0.48}" rx="1400" ry="980" fill="url(#glow1)"/>
  <ellipse cx="${W / 2}" cy="${H * 0.48}" rx="900"  ry="620" fill="url(#glow2)"/>

  <!-- ── Subtle dot grid ────────────────────────────────────── -->
  ${Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 20 }, (_, col) => {
      const x = 200 + col * 200;
      const y = 150 + row * 180;
      const opacity = (0.04 + Math.sin(col + row) * 0.02).toFixed(3);
      return `<circle cx="${x}" cy="${y}" r="3" fill="#8A84FF" opacity="${opacity}"/>`;
    }).join('')
  ).join('')}

  <!-- ── Decorative route lines ─────────────────────────────── -->
  <line x1="420"  y1="380"  x2="1050" y2="720"  stroke="#6C63FF" stroke-width="1.5" opacity="0.12" stroke-dasharray="18 10"/>
  <line x1="3060" y1="600"  x2="3680" y2="1840" stroke="#6C63FF" stroke-width="1.5" opacity="0.12" stroke-dasharray="18 10"/>
  <line x1="300"  y1="1900" x2="900"  y2="1540" stroke="#8A84FF" stroke-width="1.5" opacity="0.10" stroke-dasharray="14 10"/>
  <line x1="3200" y1="250"  x2="3750" y2="420"  stroke="#8A84FF" stroke-width="1"   opacity="0.10" stroke-dasharray="12 8"/>

  <!-- ── Location pins ──────────────────────────────────────── -->
  <!-- top-left pin -->
  <g transform="translate(420, 355)" opacity="0.45">
    <circle cx="0" cy="-14" r="18" fill="#6C63FF"/>
    <path d="M-7,0 Q0,28 0,28 Q0,28 7,0 Z" fill="#6C63FF"/>
    <circle cx="0" cy="-14" r="7" fill="#0F0F0F"/>
  </g>
  <!-- bottom-right pin -->
  <g transform="translate(3680, 1815)" opacity="0.40">
    <circle cx="0" cy="-14" r="18" fill="#8A84FF"/>
    <path d="M-7,0 Q0,28 0,28 Q0,28 7,0 Z" fill="#8A84FF"/>
    <circle cx="0" cy="-14" r="7" fill="#0F0F0F"/>
  </g>
  <!-- mid-left pin -->
  <g transform="translate(300, 1875)" opacity="0.30">
    <circle cx="0" cy="-10" r="12" fill="#6C63FF"/>
    <path d="M-5,0 Q0,18 0,18 Q0,18 5,0 Z" fill="#6C63FF"/>
    <circle cx="0" cy="-10" r="5" fill="#0F0F0F"/>
  </g>

  <!-- ── Airplane decorations ───────────────────────────────── -->
  <!-- top-right airplane -->
  <g transform="translate(3380, 310) rotate(-32) scale(2.8)" opacity="0.30">
    <path d="M0,0 L28,-7 L22,0 L28,7 Z" fill="#9D97FF"/>
    <path d="M4,-2 L-10,-18 L-15,-15 L-2,-2 Z" fill="#9D97FF" opacity="0.75"/>
    <path d="M4,2  L-10,18  L-15,15  L-2,2  Z" fill="#9D97FF" opacity="0.75"/>
    <rect x="-18" y="-1" width="8" height="2" rx="1" fill="#9D97FF"/>
  </g>
  <!-- bottom-left airplane -->
  <g transform="translate(480, 1820) rotate(18) scale(1.8)" opacity="0.22">
    <path d="M0,0 L28,-7 L22,0 L28,7 Z" fill="#8A84FF"/>
    <path d="M4,-2 L-10,-18 L-15,-15 L-2,-2 Z" fill="#8A84FF" opacity="0.75"/>
    <path d="M4,2  L-10,18  L-15,15  L-2,2  Z" fill="#8A84FF" opacity="0.75"/>
    <rect x="-18" y="-1" width="8" height="2" rx="1" fill="#8A84FF"/>
  </g>

  <!-- ── App icon ────────────────────────────────────────────── -->
  <g transform="translate(${W / 2}, 740)" filter="url(#iconShadow)">
    <rect x="-90" y="-90" width="180" height="180" rx="40" fill="url(#iconGrad)"/>
    <!-- Airplane inside icon -->
    <g transform="rotate(-30) scale(3.2)">
      <path d="M0,0 L20,-5 L15,0 L20,5 Z"          fill="white"/>
      <path d="M2,-2 L-8,-14 L-12,-11 L-1,-2 Z"     fill="white" opacity="0.88"/>
      <path d="M2,2  L-8,14  L-12,11  L-1,2  Z"     fill="white" opacity="0.88"/>
      <rect x="-12" y="-1" width="5" height="2" rx="0.5" fill="white"/>
    </g>
  </g>

  <!-- ── "Vacationist" wordmark ─────────────────────────────── -->
  <text
    x="${W / 2}" y="1060"
    font-family="Arial, Helvetica, sans-serif"
    font-size="210"
    font-weight="700"
    fill="white"
    text-anchor="middle"
    letter-spacing="-3"
    filter="url(#textGlow)"
  >Vacationist</text>

  <!-- Accent underline beneath wordmark -->
  <rect x="${W / 2 - 580}" y="1088" width="1160" height="7" rx="3.5" fill="url(#accent)" opacity="0.9"/>

  <!-- ── Tagline ─────────────────────────────────────────────── -->
  <text
    x="${W / 2}" y="1200"
    font-family="Arial, Helvetica, sans-serif"
    font-size="76"
    font-weight="300"
    fill="#9E9E9E"
    text-anchor="middle"
    letter-spacing="2"
  >Collaborative travel planning for groups</text>

  <!-- ── Feature pills ──────────────────────────────────────── -->
  <!-- Pill: Trips -->
  <g transform="translate(${W / 2 - 580}, 1310)">
    <rect width="340" height="90" rx="45" fill="#141428" stroke="#6C63FF" stroke-width="2" opacity="0.85"/>
    <text x="170" y="60" font-family="Arial, Helvetica, sans-serif" font-size="38"
          fill="#8A84FF" text-anchor="middle" font-weight="600">Trips</text>
  </g>
  <!-- Pill: Calendar -->
  <g transform="translate(${W / 2 - 175}, 1310)">
    <rect width="350" height="90" rx="45" fill="#141428" stroke="#3ECF8E" stroke-width="2" opacity="0.85"/>
    <text x="175" y="60" font-family="Arial, Helvetica, sans-serif" font-size="38"
          fill="#3ECF8E" text-anchor="middle" font-weight="600">Calendar</text>
  </g>
  <!-- Pill: Documents -->
  <g transform="translate(${W / 2 + 205}, 1310)">
    <rect width="380" height="90" rx="45" fill="#141428" stroke="#F5A623" stroke-width="2" opacity="0.85"/>
    <text x="190" y="60" font-family="Arial, Helvetica, sans-serif" font-size="38"
          fill="#F5A623" text-anchor="middle" font-weight="600">Documents</text>
  </g>

  <!-- ── Bottom tagline ─────────────────────────────────────── -->
  <text
    x="${W / 2}" y="1580"
    font-family="Arial, Helvetica, sans-serif"
    font-size="54"
    font-weight="300"
    fill="#4A4A4A"
    text-anchor="middle"
    letter-spacing="3"
  >PLAN TOGETHER  ·  TRAVEL TOGETHER</text>

  <!-- ── Corner accent marks ───────────────────────────────── -->
  <!-- top-left bracket -->
  <path d="M80,80 L80,200 M80,80 L200,80" stroke="#6C63FF" stroke-width="3" opacity="0.25" fill="none" stroke-linecap="round"/>
  <!-- top-right bracket -->
  <path d="M${W - 80},80 L${W - 80},200 M${W - 80},80 L${W - 200},80" stroke="#6C63FF" stroke-width="3" opacity="0.25" fill="none" stroke-linecap="round"/>
  <!-- bottom-left bracket -->
  <path d="M80,${H - 80} L80,${H - 200} M80,${H - 80} L200,${H - 80}" stroke="#6C63FF" stroke-width="3" opacity="0.25" fill="none" stroke-linecap="round"/>
  <!-- bottom-right bracket -->
  <path d="M${W - 80},${H - 80} L${W - 80},${H - 200} M${W - 80},${H - 80} L${W - 200},${H - 80}" stroke="#6C63FF" stroke-width="3" opacity="0.25" fill="none" stroke-linecap="round"/>
</svg>`;

console.log('Rendering SVG → PNG …');
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUT_FILE);

console.log(`Done: ${OUT_FILE}`);
