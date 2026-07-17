#!/usr/bin/env node
/**
 * Builds the DIN A4 one-pager flyer for Swiss residential distribution.
 *
 *   node marketing/flyer/build-flyer.mjs
 *
 * Output: marketing/flyer/2026-07-17_schweiz_one_pager_flyer.svg
 *
 * The production QR (qr-codes/Android/VacationistAndroidQR.svg) is inlined
 * as a nested <svg> so the flyer stays fully vector. The QR file itself is
 * never modified - see qr-codes/README.md for its design invariants.
 *
 * Coordinate system: viewBox 2100×2970 → 10 units = 1 mm (DIN A4 portrait).
 * Background is intentionally unfilled (paper white, no ink on empty areas).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const QR_SOURCE = join(repoRoot, 'qr-codes', 'Android', 'VacationistAndroidQR.svg');
const OUTPUT = join(__dirname, '2026-07-17_schweiz_one_pager_flyer.svg');

// Colorful-mode palette (see CLAUDE.md) - the only ink colors on the flyer
const ORANGE = '#FDA444';
const PURPLE = '#8c6196';
const DARKRED = '#690F0C';

const FONT = `Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`;

// ---------------------------------------------------------------- QR inline
const qrRaw = readFileSync(QR_SOURCE, 'utf8');
const qrInner = qrRaw
  .replace(/<\?xml[^?]*\?>/, '')
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();

// QR canvas is 2048×2471; the visible circle spans 2045 units of that width.
// Render the circle at 70 mm (700 units): at 300 dpi the QR data footprint is
// ~474 px, above the ~458 px decode floor of this decorative design (the
// standalone baseline in qr-codes/verify-qr.mjs is an 800 px canvas minimum).
const QR_CIRCLE = 700;
const qrScale = QR_CIRCLE / 2045;
const qrW = (2048 * qrScale).toFixed(1);
const qrH = (2471 * qrScale).toFixed(1);
const QR_X = 140;
const QR_Y = 2120;

// ---------------------------------------------------------------- content
const tips = [
  ['Datum fix machen', 'Erst wenn der Termin steht, wird aus der Idee eine Reise. Alles andere kommt danach.'],
  ['Budget offen ansprechen', 'Vor der Buchung über Geld reden erspart Diskussionen in den Ferien.'],
  ['Abstimmen statt diskutieren', 'Kurze Abstimmungen ersetzen endlose Chat-Debatten: die Mehrheit entscheidet.'],
  ['Aufgaben verteilen', 'Eine Person soll nicht alles organisieren. Unterkunft, Anreise, Aktivitäten: sorgfältig aufteilen.'],
  ['Ausgaben sofort notieren', 'Wer hat was bezahlt? Direkt festhalten statt am Ende Belege rekonstruieren.'],
  ['Packlisten führen', 'Eine private & geteilte Liste verhindert, dass etwas doppelt oder gar nicht mitkommt.'],
];

const features = [
  ['Reise planen', 'Unterkunft, Anreise, Aktivitäten, alles in einer App.'],
  ['Chat', 'Mitreisende können sich direkt in der App austauschen.'],
  ['Abstimmungen', 'Jede Stimme zählt - von Positiv bis Veto.'],
  ['Kosten fair teilen', 'Wie andere Apps + komplette Reiseplanung.'],
  ['Listen in Echtzeit', 'Einkaufs- und Packlisten, sofort synchron.'],
  ['Kalender', 'Pro Reise und über alle Reisen hinweg.'],
  ['Einladen per Link', 'Mitreisende brauchen kein eigenes Konto.'],
  ['Export der Reise', 'Alle Reisendaten in einer übersichtlichen Datei.']
];

// ---------------------------------------------------------------- layout
// Section positions derive from the item counts so tips/features can be
// added or removed without sections colliding. The QR block stays fixed.
const TIP_Y0 = 590;
const ROW_STEP = 120;
const tipsBottom = TIP_Y0 + (tips.length - 1) * ROW_STEP + 46;
const BRIDGE_Y = tipsBottom + 122;
const PANEL_Y = BRIDGE_Y + 70;
const featRows = Math.ceil(features.length / 2);
const FEAT_Y0 = PANEL_Y + 182;
const PANEL_H = 182 + (featRows - 1) * ROW_STEP + 44 + 74;
if (PANEL_Y + PANEL_H > 2100) {
  throw new Error(`Features panel ends at ${PANEL_Y + PANEL_H} and would collide with the QR block (y=2120) — remove content.`);
}

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const tipsSvg = tips
  .map(([title, desc], i) => {
    const y = TIP_Y0 + i * ROW_STEP;
    return `
  <circle cx="148" cy="${y - 13}" r="27" fill="${ORANGE}"/>
  <text x="148" y="${y}" font-family="${FONT}" font-size="36" font-weight="800" fill="${DARKRED}" text-anchor="middle">${i + 1}</text>
  <text x="205" y="${y}" font-family="${FONT}" font-size="40" font-weight="700" fill="${DARKRED}">${esc(title)}</text>
  <text x="205" y="${y + 46}" font-family="${FONT}" font-size="33" fill="${DARKRED}">${esc(desc)}</text>`;
  })
  .join('\n');

const featuresSvg = features
  .map(([title, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 190 : 1090;
    const y = FEAT_Y0 + row * ROW_STEP;
    return `
  <circle cx="${x}" cy="${y - 12}" r="12" fill="${PURPLE}"/>
  <text x="${x + 40}" y="${y}" font-family="${FONT}" font-size="38" font-weight="700" fill="${DARKRED}">${esc(title)}</text>
  <text x="${x + 40}" y="${y + 44}" font-family="${FONT}" font-size="32" fill="${DARKRED}">${esc(desc)}</text>`;
  })
  .join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="210mm" height="297mm"
     viewBox="0 0 2100 2970"
     role="img"
     aria-label="Vacationist Flyer - ${tips.length} Tipps für Gruppenreisen und App-Download">
  <title>Vacationist - Gruppenreisen einfach planen</title>

  <!-- Header -->
  <text x="120" y="230" font-family="${FONT}" font-size="120" font-weight="800" letter-spacing="-4" fill="${PURPLE}">Vacationist</text>
  <text x="120" y="312" font-family="${FONT}" font-size="44" font-weight="600" fill="${DARKRED}">Planen - Abstimmen - Kosten teilen - Gemeinsam reisen</text>
  <rect x="120" y="358" width="1860" height="7" rx="3.5" fill="${ORANGE}"/>

  <!-- Tips -->
  <text x="120" y="500" font-family="${FONT}" font-size="62" font-weight="800" fill="${DARKRED}">${tips.length} Tipps für eure nächste Gruppenreise</text>
${tipsSvg}

  <!-- Bridge -->
  <text x="1050" y="${BRIDGE_Y}" font-family="${FONT}" font-size="54" font-weight="800" fill="${PURPLE}" text-anchor="middle">Alles davon erledigt eine einzige App.</text>

  <!-- Features -->
  <rect x="120" y="${PANEL_Y}" width="1860" height="${PANEL_H}" rx="24" fill="none" stroke="${ORANGE}" stroke-width="4"/>
  <text x="190" y="${PANEL_Y + 100}" font-family="${FONT}" font-size="54" font-weight="800" fill="${PURPLE}">Vacationist - die App für Gruppenreisen</text>
${featuresSvg}

  <!-- CTA + QR -->
  <svg x="${QR_X}" y="${QR_Y}" width="${qrW}" height="${qrH}" viewBox="0 0 2048 2471">
${qrInner}
  </svg>
  <text x="880" y="2310" font-family="${FONT}" font-size="66" font-weight="800" fill="${DARKRED}">Jetzt installieren</text>
  <text x="880" y="2382" font-family="${FONT}" font-size="38" fill="${DARKRED}">Android: Scannen, App laden, losplanen</text>
  <rect x="880" y="2428" width="380" height="6" rx="3" fill="${ORANGE}"/>
  <text x="880" y="2510" font-family="${FONT}" font-size="38" font-weight="600" fill="${DARKRED}">iPhone oder PC?</text>
  <text x="880" y="2568" font-family="${FONT}" font-size="44" font-weight="700" fill="${PURPLE}">Web-App: web.vacationist.app</text>
  <text x="880" y="2668" font-family="${FONT}" font-size="36" fill="${DARKRED}">Weitere Infos: vacationist.app</text>

  <!-- Footer -->
  <text x="1050" y="2884" font-family="${FONT}" font-size="32" fill="${DARKRED}" text-anchor="middle">Direkt planen · Keine Werbung · Entwickelt von Privatpersonen auf Basis ihrer Erfahrungen</text>
</svg>
`;

writeFileSync(OUTPUT, svg, 'utf8');
console.log(`Flyer written: ${OUTPUT} (${(svg.length / 1024).toFixed(0)} KB)`);
