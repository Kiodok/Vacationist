# Vacationist QR Codes

Static, self-hosted QR codes for Vacationist marketing and print materials, generated with the `qrcode` npm package — no paid service (qr.io) required. The visual design reproduces the original qr.io template exactly; only the QR in the center is our own static code.

**Current production QR** encodes `https://vacationist.app/scan/android-qr` (landing page in `docs/scan/android-qr/`, redirects users to the Play Store with UTM tracking).

---

## Directory layout

```
qr-codes/
  generate-qr.mjs                          ← generator (SVG from template-pattern.json + fresh QR)
  extract-template.mjs                     ← one-time template analyzer (only re-run if template changes)
  verify-qr.mjs                            ← scanability check (zxing-wasm, multi-size)
  README.md                                ← this file
  Android/
    VacationistAndroidQR.svg               ← production SVG (vector output of generate-qr.mjs)
    VacationistAndroidQR.png               ← production PNG (2048×2471, rasterised from the SVG)
    VacationistAndroidQR_template.png      ← original qr.io design (visual reference + pattern source)
    template-pattern.json                  ← extracted design data: geometry, colors, all 511 filler modules
    HERMA_Vacationist_QR_Etikette_4x4.pdf  ← print-ready label sheet (4×4 grid)
    HERMA_Vacationist_QR_Etikette_4x4.lao  ← HERMA label software source file
    Druckeinstellungen_PDF_HERMA_Vacationist_QR_Etikette_4x4.png  ← print settings screenshot
```

Dependencies (`qrcode`, `sharp`, `sharp-cli`, `zxing-wasm`) are root devDependencies — `npm install` once after cloning.

---

## Design anatomy

The design has **two independent layers** (this is the key thing to understand — an earlier attempt failed by missing it):

1. **A real, scannable QR centered in the circle** (~57 % of the circle diameter): pure black `#000000` data modules with orange/white/black rounded finder patterns. Version 3 (29×29 modules), error correction M.
2. **Decorative purple filler modules** filling the rest of the circle. These are *not* QR data — they are ornamental, sit on their *own* grid (pitch ≈ 35.7 px vs the QR's 40.45 px), and were extracted pixel-exactly from the qr.io template into `template-pattern.json`. They are **never regenerated or re-randomized**.

Everything outside the circle is **transparent** (the canvas has ~420 px of extra transparent space at the bottom, kept for template parity).

### Measured specifications (all in px on the 2048×2471 canvas)

| Element | Value | Notes |
|---------|-------|-------|
| Canvas | 2048 × 2471 | transparent background |
| Circle | center (1024.5, 1024.5), outer r 1022.5 | white fill |
| Ring | 39 px stroke, `#8c6196` | = colorful-mode `primary` token |
| QR footprint | origin (438, 438), span 1173 | pitch 40.448 px at version 3 |
| QR data modules | `#000000`, flush squares | drawn with 0.5 px bleed (see below) |
| Finder outer | 7 modules (283), `#fda444`, corner r 69 | = colorful-mode `background` token; ring 1 module thick |
| Finder gap | 5 modules (202), white, corner r 29 | follows the orange ring's inner curve |
| Finder center | 3 modules (121), `#000000`, corner r 23 | |
| Filler modules | 511 rects, ~36 px, various purples | `#8c6196` down to pale lavender, exact per-module colors in JSON |
| Shadow | none | template's lower area is plain transparent |

**Why the 0.5 px bleed on data modules:** adjacent flush rects rendered by an SVG rasterizer leave antialiased hairline seams; when the image is downscaled these seams lighten the black areas enough to break decoding at small sizes. Each module rect is expanded 0.5 px on all sides so neighbors merge into solid blobs, like the template raster.

---

## Regenerating the production QR

```bash
# 1. SVG (deterministic — same input produces the same output)
node qr-codes/generate-qr.mjs

# 2. PNG at template resolution
npx sharp-cli --input "qr-codes/Android/VacationistAndroidQR.svg" \
              --output "qr-codes/Android/VacationistAndroidQR.png" \
              resize 2048 2471

# 3. Verify scanability (must pass before shipping)
node qr-codes/verify-qr.mjs
```

`verify-qr.mjs` decodes the QR with zxing-wasm (the detector family real phone scanners use) at 800/1024/1400/2048 px and requires all sizes to decode. The original qr.io template passes exactly this matrix — it is the robustness baseline.

### Custom URL or output path

```bash
node qr-codes/generate-qr.mjs --url "https://example.com" --output "qr-codes/iOS/MyQR.svg"
npx sharp-cli --input "qr-codes/iOS/MyQR.svg" --output "qr-codes/iOS/MyQR.png" resize 2048 2471
node qr-codes/verify-qr.mjs --input "qr-codes/iOS/MyQR.svg" --url "https://example.com"
```

**URL length matters:** the template footprint fits a version-3 QR (29×29, ≤ 42 bytes at ECC M). A longer URL raises the QR version and the generator shrinks the modules to keep the same footprint (it prints a warning). That still scans, but modules get denser — prefer URLs ≤ 42 bytes.

### Re-extracting the template pattern

Only needed if `VacationistAndroidQR_template.png` itself is ever replaced:

```bash
node qr-codes/extract-template.mjs   # rewrites Android/template-pattern.json
```

---

## For Claude: how to create or update QR codes

When asked to create, update, or regenerate a Vacationist QR code:

1. **Never re-randomize the decorative filler.** The purple filler pattern lives in `Android/template-pattern.json` and is the extracted original design. `generate-qr.mjs` reads it; only the central QR changes between runs.
2. Run the three commands under *Regenerating the production QR* (generate → rasterise 2048×2471 → verify). All are deterministic; `qrcode`, `sharp-cli`, `zxing-wasm` are already installed.
3. **`verify-qr.mjs` must pass at all sizes.** If it fails, do not tweak thresholds in the verifier — fix the render. Known failure causes: hairline seams between data modules (keep the 0.5 px bleed), anything overlapping the QR's quiet zone, filler colors darkened beyond the template's.
4. **Visual check:** publish an HTML artifact embedding the new PNG and `VacationistAndroidQR_template.png` side by side (base64 data URIs; give both a white page background — the PNGs are transparent). The two should be indistinguishable except for the module pattern inside the central QR.
5. **Ask the user to phone-scan** the result (from screen and ideally a print) before considering the task done. zxing-wasm is a good proxy, not a guarantee.
6. For a *new* permanent QR (e.g. iOS), create a sibling directory `qr-codes/iOS/` and pass `--url`/`--output`. Keep the URL ≤ 42 bytes so the version-3 footprint is preserved (step 3 warning explains why).
7. Design invariants:
   - Colors stay on the extracted values (ring `#8c6196`, finder orange `#fda444`, modules `#000000`) — they intentionally match the app's colorful-mode palette in `CLAUDE.md`.
   - Background outside the circle stays transparent; no drop shadow.
   - PNG is always rasterised at 2048×2471 (`resize 2048 2471`, never square).
   - Do not edit `template-pattern.json` by hand; it is generated by `extract-template.mjs`.
8. Do not commit — the user tests and approves first.

---

## Print instructions (HERMA label sheet)

`HERMA_Vacationist_QR_Etikette_4x4.lao` is a HERMA label software project for printing a 4×4 grid of labels.

1. Open the `.lao` file in HERMA LabelAssistant / LabelDesign
2. Replace the embedded QR image with the new `VacationistAndroidQR.png` (or the SVG)
3. Print settings are documented in `Druckeinstellungen_PDF_HERMA_Vacationist_QR_Etikette_4x4.png`
4. `HERMA_Vacationist_QR_Etikette_4x4.pdf` is the last exported print-ready sheet

After printing, scan a physical label with a phone camera to confirm it opens `https://vacationist.app/scan/android-qr`.
