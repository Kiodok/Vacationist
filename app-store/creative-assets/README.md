# App Store Connect creative assets

Binary creative for the **Produktseiteninformationen → Kopfzeile / Suchergebnisse**
placements (new in iOS 27 / iPadOS 27, GA 2026-09-14). This is **not** a listing-metadata
folder — subtitle, keywords, description, promotional text, and "What's New" stay managed
directly in App Store Connect, per the Phase 16 decision recorded in
`.claude/skills/ios-app-store-rollout/SKILL.md`. Only exported image files live here.

## Current contents

| File | Placement | Status |
|---|---|---|
| `header-3840x1646.png` | Produktseiteninformationen → Kopfzeile | Generated, not yet uploaded |
| `search-3840x2560-en.png` | Produktseiteninformationen → Suchergebnisse (en-US only) | Generated, not yet uploaded |

The **Suchergebnisse** well only offers "Durchsuche deine genehmigten Inhalte" (Browse
Assets) — a search-results image must already be uploaded and approved in the **Asset
Library** before it can be selected there; it is not a drop target the way the header is. See
"Uploading" below for the exact flow.

`search-3840x2560-en.png` is **en-US only, not yet uploaded to de-DE**. No German screenshot
exists anywhere in the repo (the seeded demo trip is hard-coded English with no locale
parameter) — producing one needs a live capture session with the Tech Lead present
(`npm run web`, switch the app to Deutsch via Profile → Edit Profile → Language, capture via
`claude-in-chrome`) plus an idiomatic German headline translation, not a literal one. Until
then the de-DE localization keeps Apple's documented fallback (app previews/screenshots) —
exactly today's behavior, no regression.

## Spec — product page header

Verified directly against Apple's own template (not just third-party docs — see
"How the safe area was verified" below).

| | |
|---|---|
| Canvas | **3840 × 1646 px** (21:9), exact — not a range |
| Format | PNG or JPEG, **no alpha channel** |
| Art safe area | centred **1646 × 661** box: x `1097–2743`, y `493–1154` out of the 3840×1646 canvas. Anything outside it may be cropped on some device/orientation. |
| OS requirement | iOS 27 / iPadOS 27 or later (older OS versions never see it) |
| Submission | Upload via a version, **or standalone through Asset Library** — a standalone asset is reviewed against the app's current released version, no new build or binary required |
| Localization | One asset can be placed on every localization. (Only applies here because the asset is deliberately text-free — see below.) |

Apple's content rules for this asset (all enforced, confirmed clean on `header-3840x1646.png`):
no pricing/discounts, no URLs, no `©`, no other-platform logos or references (this also rules
out ever compositing a raw Android screenshot into this asset — those captures include the
Android status bar/nav chrome), no award or "Editor's Choice"-style claims, must suit a 4+
age rating.

## Design decisions (Tech Lead, 2026-10-18)

- **Text-free.** App mark + "Vacationist" wordmark only, no sentence copy. One asset serves
  both EN and DE — copy would have forced two files and two review cycles.
- **Warm "colorful" palette** (`#FDA444` → `#FECE8A` field, `#690F0C` text, `#8c6196` accent),
  not the dark/violet palette used by the app icon, vacationist.app, and
  `play-store/header.png`. Chosen because the live App Store screenshots sitting directly
  below the header are colorful-mode captures — this keeps the top of the product page visually
  continuous instead of a jarring dark→orange cut.
- Brand lockup (`logoMark()` from `scripts/lib/brandSvg.mjs`) sits centred inside the safe
  box; everything outside it — gradient field, dashed route lines, map pins, paper-plane
  glyphs, dot grid — is free bleed and may be cropped without losing anything load-bearing.

## Spec — search results

Also verified against Apple's own PSD template (same method as the header — see below).

| | |
|---|---|
| Canvas | **3840 × 2560 px** (3:2, the max size; min is 1920×1280 at the same ratio) |
| Format | PNG or JPEG, **no alpha channel** |
| Art safe area | centred **2168 × 1030** box: x `836–3004`, y `765–1795` out of the 3840×2560 canvas |
| OS requirement | iOS 27 / iPadOS 27 or later |
| Submission | Asset Library only — **not** a version drop target, see "Uploading" |
| Localization | **Per-language**, unlike the header — a placement attaches to one App Store localization at a time. Ship `search-3840x2560-en.png` to en-US; de-DE has none yet (see "Current contents"). |

Apple's own practical guidance for this placement is the opposite of the header's: **"state
the obvious," show firsthand UI, one large screen rather than a collage** (several small
screenshots become illegible at actual search-card thumbnail size, ~384 px wide) — so unlike
the header, this asset composites a real screenshot.

### Design decisions (Tech Lead, 2026-10-18)

- **Hero screen: Balances & Settlements** (`play-store/screenshots/screenshot_greece_expenses_settlements.jpg`)
  — the settle-up card and the app's only donut chart (`ExpenseCategoryChart`, rendered
  nowhere else in the app). Most differentiating screen vs. Splitwise-style competitors.
- **Headline reused verbatim, not reworded** — eyebrow `SPLIT EXPENSES`, headline `"Split
  every cost."` / `"Know who owes what."`, copied from `scripts/generate-producthunt-assets.mjs`'s
  caption table for this exact slug. The longer PH sub-line is dropped; Apple wants a short
  phrase, not a paragraph.
- **EN-only for now** — see "Current contents" above for why and what's needed to add de-DE.
- Same warm colorful palette as the header, for visual continuity between the two assets.
- The phone is sized and positioned so the title, the "You are owed" amount, and the
  settlement rows land inside/near the safe box and remain legible at the real ~384px
  thumbnail size (checked directly — see "Regenerating"). The donut chart further down the
  screen bleeds off the canvas entirely; that's an accepted trade-off, not a bug — Apple's
  safe box prioritizes the headline and the first card, not everything on the source screen.
- Source screenshot is cropped via the **existing, unmodified** `scripts/lib/phoneFrame.mjs`
  (`CONTENT_TOP=130`/`CONTENT_BOTTOM=2326`, same as every other derived asset) — this removes
  the Android status bar and 3-button nav bar, which Apple's "no other-platform references"
  rule would otherwise forbid.

## Regenerating

```bash
npm run assets:appstore                       # writes header-3840x1646.png (horizontal lockup)
node scripts/generate-appstore-creative.mjs --variant=stacked   # mark above wordmark, for comparison
```

The script is deterministic — rerunning it with the same variant produces a byte-identical
file (same pattern as `marketing/site/og-image.mjs`: fixed `compressionLevel`, no
`.withMetadata()`).

Two lockup variants exist because the real app icon is also displayed next to the header
elsewhere on the product page, and it isn't documented anywhere how close the two sit — the
horizontal lockup risks reading as a duplicated icon. `header-3840x1646.png` ships the
horizontal variant (more conventional side-by-side lockup); regenerate with `--variant=stacked`
and compare both in App Store Connect's **Preview** tool before deciding. Preview is also the
only authoritative crop check — it shows the actual iPhone/iPad/orientation/localization crops,
which the `--proof` flag below only simulates.

```bash
APPSTORE_PROOF_DIR=/path/to/scratchpad node scripts/generate-appstore-creative.mjs --proof
```

writes a safe-area overlay and progressively narrower centre-crop simulations (3000w, 2400w,
2000w, and the exact safe box) to a scratch directory outside the repo — useful for a quick
sanity check, but not a substitute for ASC Preview.

```bash
npm run assets:appstore-search                 # writes search-3840x2560-en.png

APPSTORE_PROOF_DIR=/path/to/scratchpad node scripts/generate-appstore-search-card.mjs --proof
```

The `--proof` run for the search card writes a safe-area overlay, the exact safe-box crop,
and a 384px-wide render simulating the real search-result thumbnail size — the thumbnail is
the most important one to actually look at, since Apple's own guidance for this placement is
specifically about legibility at that size.

## How the safe areas were verified

Apple's numbers are quoted consistently by third-party ASO guides, but those aren't primary
sources. Both were confirmed exactly against Apple's own official templates by downloading
them and parsing their layers with the `ag-psd` library:

- **Header**: `https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-product_page_header_template-static.psd`
  — "Art Safe Area" layer bounds `left=1097 top=493 right=2743 bottom=1154`, canvas 3840×1646.
- **Search results**: `https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-search_results_template-static.psd`
  — "Art Safe Area" layer bounds `left=836 top=765 right=3004 bottom=1795`, canvas 3840×2560.

Both PSDs are large (40–65 MB); don't commit them — download to a scratch directory, inspect,
delete.

## Uploading

**Header** — App Store Connect → your app → **Produktseiteninformationen → Header and Search
Results tab → Header** → drag in `header-3840x1646.png` directly, or upload it to the Asset
Library first and select it there for a standalone, version-independent submission.

**Search results** — the well does **not** accept a direct drop. Upload first:
1. App Store Connect → **Asset Library** → upload `search-3840x2560-en.png` → wait for Apple's
   review/approval (standalone assets are reviewed against the app's current released
   version, no new build needed).
2. Back on the app → **Produktseiteninformationen → Header and Search Results tab → Search
   Results** → **Browse Assets** (this is the "Durchsuche deine genehmigten Inhalte" option —
   it only lists what's already approved in the Asset Library) → select the asset → Save.
3. Set the **localization** to English (this placement is per-language, not shared across
   localizations like the header).
4. If the app version is already live: **Browse Assets → Next → Publish** — no new app
   version submission needed, per Apple's own docs.

Always check **Preview** (iPhone, iPad, both orientations, every localization that has an
asset) before publishing — Apple does not publish an exact crop algorithm per device, only
"keep the focal point centred."
