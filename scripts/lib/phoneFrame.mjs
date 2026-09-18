/**
 * Shared phone-frame compositing for the Product Hunt launch assets
 * (scripts/generate-producthunt-assets.mjs, scripts/generate-producthunt-video.mjs).
 *
 * Takes a Greece device screenshot (play-store/screenshots/screenshot_greece_*.jpg, 1080×2460,
 * captured with Android chrome), crops the chrome off, scales it, rounds the corners and wraps
 * it in a bezel. The CONTENT_TOP/BOTTOM crop is identical to generate-ios-screenshots.mjs and
 * generate-web-screenshots.mjs — keep all of them in sync if a re-capture changes the geometry.
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const SCREENSHOTS_DIR = resolve(__dir, '../../play-store/screenshots');

export const SOURCE = { width: 1080, height: 2460 };
export const CONTENT_TOP = 130;
export const CONTENT_BOTTOM = 2326;
export const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

export const BEZEL = 10;

/**
 * The screenshot scaled to `pw` wide, corners rounded, wrapped in a bezel. Returns a PNG buffer
 * plus its outer size and corner radius. `dim` (0–1) darkens it — used to push a phone "back".
 */
export async function phoneLayer(file, pw, dim = 1) {
  const src = resolve(SCREENSHOTS_DIR, file);
  const meta = await sharp(src).metadata();
  if (meta.width !== SOURCE.width || meta.height !== SOURCE.height) {
    throw new Error(
      `${file}: expected ${SOURCE.width}×${SOURCE.height}, got ${meta.width}×${meta.height}. ` +
        `The hardcoded crop window is only valid for the expected geometry — re-measure first.`,
    );
  }

  const ph = Math.round((pw * CONTENT_HEIGHT) / SOURCE.width);
  const radius = Math.round(pw * 0.09);
  const mask = Buffer.from(
    `<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="${radius}" fill="#fff"/></svg>`,
  );

  const screen = await sharp(src)
    .extract({ left: 0, top: CONTENT_TOP, width: SOURCE.width, height: CONTENT_HEIGHT })
    .resize({ width: pw, height: ph })
    .modulate({ brightness: dim })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const ow = pw + BEZEL * 2;
  const oh = ph + BEZEL * 2;
  const bezel = Buffer.from(
    `<svg width="${ow}" height="${oh}"><rect x="1" y="1" width="${ow - 2}" height="${oh - 2}" rx="${radius + BEZEL}" fill="#17171b" stroke="#3b3b45" stroke-width="2"/></svg>`,
  );

  const buf = await sharp(bezel)
    .composite([{ input: screen, left: BEZEL, top: BEZEL }])
    .png()
    .toBuffer();

  return { buf, width: ow, height: oh, radius: radius + BEZEL, screenWidth: pw, screenHeight: ph };
}

/**
 * Clip a phone layer to a canvas of `canvasH` when placed at `top`, so it can bleed off the
 * bottom edge — sharp's composite() rejects an overlay that extends past its base image.
 */
export async function clipToCanvas(layer, top, canvasH) {
  const visible = Math.min(layer.height, canvasH - top);
  if (visible <= 0) return null;
  return visible >= layer.height
    ? layer.buf
    : sharp(layer.buf).extract({ left: 0, top: 0, width: layer.width, height: visible }).png().toBuffer();
}
