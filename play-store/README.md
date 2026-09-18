# Play Store Assets

Store-listing assets for Google Play and (derived) App Store Connect.

## Files

| File | Purpose | Size | How it's made |
|------|---------|------|---------------|
| `icon.svg` → `icon.png` | App icon | 512 × 512 PNG | `sharp-cli` (below) |
| `feature-graphic.svg` → `feature-graphic.png` | Feature graphic | 1024 × 500 PNG | `sharp-cli` (below) |
| `header.png` | Play Console header image | 4096 × 2304 PNG | `node scripts/generate-play-header.mjs` |
| `screenshots/screenshot_greece_*.jpg` | Play Store screenshots (8 screens) | 1080 × 2460 | Hand-captured on a physical Android device |
| `screenshots/screenshot_greece_*_ios_6.5in.jpg` | App Store 6.5" screenshots | 1242 × 2688 | `npm run screenshots:ios` (derived from the above) |
| `listing.md` | Store listing text — EN + DE | — | Hand-written; source for both consoles |

The privacy policy is `../docs/privacy-policy.html`, live at
`https://vacationist.app/privacy-policy.html` and registered in the Play Console.

## Screenshots

The Greece set is the Tech Lead's chosen store set (Growth Plan Q4 2026, Decision 4) and matches the
live listings. The originals are real device captures **including Android system chrome** (status bar
above row 130, 3-button nav bar below row 2326). Everything derived from them crops that chrome off with
the same window — `CONTENT_TOP = 130` / `CONTENT_BOTTOM = 2326` — which lives in
`scripts/generate-ios-screenshots.mjs`, `scripts/generate-web-screenshots.mjs` and
`scripts/lib/phoneFrame.mjs`. **If you re-capture at a different geometry, re-measure and change all
three.** Each script refuses a source that isn't 1080 × 2460 rather than crop it wrongly.

Derived outputs from the same set:

| Command | Output |
|---------|--------|
| `npm run screenshots:ios` | `screenshots/*_ios_6.5in.jpg` (App Store) |
| `npm run screenshots:web` | `docs/assets/img/*.webp` (marketing site feature pages) |
| `npm run assets:producthunt` | `social-media/product-hunt/` (Product Hunt gallery + thumbnail) |

The 9 `screenshot_barcelona_*.jpg` files in `social-media/reddit/ads/` are a different demo trip for Reddit
ad creatives only — not for the store listings.

## Convert SVGs to PNG

```bash
npm exec sharp-cli -- --input icon.svg --output icon.png --width 512 --height 512
npm exec sharp-cli -- --input feature-graphic.svg --output feature-graphic.png --width 1024 --height 500
```

## Updating the listing

`listing.md` holds the text for both stores. When it changes it does **not** update anything by itself —
paste it into Play Console → Store listing (per locale) and App Store Connect. Every claim in it should be
one the marketing site already makes (`marketing/site/content/features/`).
