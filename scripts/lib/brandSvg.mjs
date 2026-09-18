/**
 * Brand SVG primitives shared by the Product Hunt asset scripts. Same logo mark and palette as
 * marketing/site/og-image.mjs (which keeps its own copy — it is part of the deterministic site
 * build and shouldn't depend on scripts/).
 */

export const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The 44×44 app mark. Needs the `logo-grad` gradient from brandDefs() in the same SVG. */
export function logoMark(x, y) {
  return `<g transform="translate(${x}, ${y})">
    <rect width="44" height="44" fill="url(#logo-grad)" rx="10"/>
    <path d="M 9 9 L 22 31 L 35 9" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="22" cy="31" r="4.5" fill="#6C63FF"/>
    <circle cx="22" cy="31" r="2" fill="#fff"/>
  </g>`;
}

/** `logo-grad` (the mark) and `hl` (the #8B83FF→#C4BDFF headline gradient). */
export function brandDefs() {
  return `<radialGradient id="logo-grad" cx="42%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#6C63FF"/>
      <stop offset="100%" stop-color="#18162D"/>
    </radialGradient>
    <linearGradient id="hl" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8B83FF"/>
      <stop offset="100%" stop-color="#C4BDFF"/>
    </linearGradient>`;
}

/** Greedy word wrap; `charW` is an average glyph width as a fraction of the font size. */
export function wrap(text, fontSize, maxWidth, charW = 0.5) {
  const perLine = Math.max(1, Math.floor(maxWidth / (fontSize * charW)));
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > perLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
