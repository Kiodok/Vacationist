---
name: reddit-ad-creatives
description: Use when creating, updating, or reviewing paid Reddit Ads creatives (videos, thumbnails, image ads) for Vacationist — folder location, naming, Reddit's asset specs, the render pipeline, and the brand system to match. The creatives live in social-media/reddit/ads/.
---

# Reddit Ads creatives

All paid-ads creatives live **flat in `social-media/reddit/ads/`**. There is **no `reddit/`
folder at the repo root** and **no `screenshots/` (or other) subfolder** under `ads/` — the root
`reddit/screenshots/` tree was moved into `social-media/reddit/ads/` on 2026-09-08. Commit
**outputs only** (`.mp4`, `.jpg`); build sources stay in the scratchpad (matches commit
`afcdaa1`, which committed only the first video's `.mp4`).

**Naming:** `YYYY-MM-DD_<slug>.mp4` for videos, `YYYY-MM-DD_thumb-NN-<slug>.jpg` for thumbnails.
`-dach` in the slug marks a German/DACH creative.

## What exists

| File | What |
|---|---|
| `2026-07-13_gruppenchat-chaos-dach.mp4` | Video #1 — hook *„Schluss mit dem Gruppenchat-Chaos"* → vote instead of argue. 1080×1920, DACH. |
| `2026-09-08_wer-schuldet-wem-dach.mp4` | Video #2 — hook *„Wer schuldet wem?"* → settle up (Splitwise-alternative intent). 15.0 s, 1080×1920, ~925 KB, DACH. |
| `2026-09-08_thumb-01..05-*.jpg` | 5 compact thumbnails (400×300), cropped from the real colorful-theme app screenshots. No text overlay. Deliberately spread across the product and **not tied to any one video's story** — `planer` (trip overview + tabs), `abstimmung` (Must-do voting card), `fluege` (flight Winner/Booked), `packliste` (shared packing list), `kosten-splitten` (Even/Exact/Shares split toggle). |
| `screenshot_barcelona_*.jpg` | 9 real device screenshots (colorful/orange theme, 1080×2460) — source material for thumbnails and video mockups. |

## Reddit asset specs (verified Sept 2026)

- **Video:** MP4/MOV, ≤1 GB, 24–30 fps, 1080p+. ARs incl. **9:16**. Length 2 s–15 min,
  **5–30 s sweet spot**. Autoplay is **muted** → bake every message into the picture.
  Safe zones: critical content in the **top two-thirds**; leave the **bottom ~20 %** clear for
  Reddit's engagement bar. Headline text ≤ 80 chars for mobile.
- **Thumbnail:** **400×300 (4:3), ≤ 500 KB**, JPG/PNG. Used in small formats only — shown before
  autoplay / when autoplay is off / in compact feed. **Simple images without overlaid marketing
  text** perform best and is the Tech Lead's stated rule — one bold focal point that survives
  being 400 px wide. In-app UI labels inside a screenshot crop are fine; added campaign copy is
  not. Treat thumbnails as **standalone creatives** for the campaign, not the preview frame of a
  specific video — keep their subjects independent of any video's storyline.
- **Image ad:** JPG/PNG ≤ 3 MB; ARs 1:1 (1080×1080), 4:5 (1080×1350), 4:3, 16:9 (1920×1080).

## Render pipeline (no repo deps)

ffmpeg is **not installed on this machine** and there is no global ImageMagick/rsvg. Build in a
scratchpad Node project:

1. `npm i sharp ffmpeg-static` in the scratchpad (never in the repo). `sharp` from the repo's
   `node_modules` also works for stills but importing it cross-drive on Windows is fiddly — a
   local install is simpler.
2. **Video** = animated SVG → per-frame PNG (`sharp(Buffer.from(svg(f))).png()`) →
   `ffmpeg -framerate 30 -i f%04d.png -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 20 -movflags +faststart`.
   No audio track. Render ~8 frames concurrently.
3. **Thumbnails** = `sharp(src).extract({left,top,width,height}).resize(400,300,{fit:'cover'}).jpeg({quality:86,mozjpeg:true})`.
4. Verify by extracting checkpoint frames with `ffmpeg -ss <t> -i out.mp4 -frames:v 1` and
   **actually viewing them** — check the hook lands < 1 s, nothing sits in the bottom 20 %, and
   umlauts render.

## Brand system (match this)

Mirror `social-media/instagram/posts/2026-07-13_gruppenchat-chaos-dach.svg`: ground `#0F0F0F`,
28 px dot-grid, radial violet glow (`#26145C`), primary `#6C63FF`, headline gradient
`#8B83FF→#C4BDFF`, accent green `#3ECF8E`, phone mockup with `cardGlow`/`chipShadow` filters,
floating annotation chips, font stack `'Segoe UI', system-ui`. CTA end card: **Vacationist**
wordmark + „Der kostenlose Gruppenreise-Planer" + `vacationist.app` + „Jetzt gratis · Play Store
& App Store".

## Content accuracy

Everything shown must be a faithful dramatization of the real app. Use the **real German product
strings** (e.g. `packages/i18n/src/locales/de/expenses.json`: `modal.title` = „Salden &
Abrechnungen", `modal.settleAll` = „Alles begleichen", `modal.bankAccountTitle` =
„Kontostand-Realität", `modal.paymentsCount_other` = „{{count}} Zahlungen zum Ausgleich aller
Schulden"), not fresh translations. Numbers must be internally consistent (balances sum to 0);
the source screenshots are occasionally mid-edit and don't balance — build a clean dataset that
matches the screen *design*, not the broken figures. Video #2's dataset: donut Aktivität €150 /
Transport €20 / Allgemein €172 (= €342); balances Gabriel +95,50 / Julia 0 / Alex −23,50 /
Sarah −72,00; settlements Sarah→Gabriel 72,00 + Alex→Gabriel 23,50.

Related: [[marketing-v1-34-0-rollout]] (campaign angles / value-prop priority), [[commit-discipline]],
[[no-branches-main-only]].
