---
name: marketing-site-build
description: Use whenever touching the marketing site (docs/, vacationist.app, GitHub Pages) or anything under marketing/site/content — SEO pages are generated from Markdown via npm run build:site and the generated HTML in docs/ must never be hand-edited.
---

# Marketing site SEO build pipeline

The marketing site (`docs/`, GitHub Pages, `vacationist.app`) has an SEO content pipeline since July 2026:

- **Source:** Markdown + front matter in `marketing/site/content/**` (`vs/`, `alternatives/`, `blog/`, `features/`, `de/`).
- **Build:** `npm run build:site` → `marketing/site/build.mjs` (uses the `marked` devDep) generates `docs/**/index.html`, `docs/assets/site.css` (from `marketing/site/site.css`), regenerates `docs/sitemap.xml`, and generates the `/blog/` index from `blogIndex: true` front matter.
- **Never edit generated HTML in `docs/{vs,alternatives,blog,features,de,assets}` or `docs/sitemap.xml` directly** — edit the `.md`/`.css` source and rebuild. The build is idempotent (dates come from front matter, never the clock).
- Front matter fields: `title`, `description`, `path` (canonical, drives output), `lang`, `type`, `schema`, `date`, `updated`, `keywords`, `blogIndex`, `related` (comma paths → cards), `breadcrumbLabel`, `altPath` (bidirectional hreflang partner; `/` is allowed for the hand-authored homepage).
- FAQPage JSON-LD is auto-extracted from `## Frequently asked questions` / `## Häufige Fragen` sections (`### question` + answer paragraphs).
- German pages live at real `/de/` URLs (crawlable), paired via hreflang. **`/de/` (`docs/de/index.html`) is NOT authored — `build.mjs` generates it by transforming `docs/index.html` with `docs/i18n/de.js` translations** (same hero/mockup/features, static German, no `i18n.js`). Editing `index.html` or `de.js` requires a rebuild; bump `DE_HOME_LASTMOD` in `build.mjs` for material changes.
- Language UX (DACH-first): **DE always before EN** in switchers. On `/`, the DE switcher is a link to `/de/` with `data-lang="de"` (client-side detection highlights it); EN on `/de/` links to `/?lang=en` (`i18n.js` supports a `?lang=` override that persists to localStorage). Generated pages always show a DE|EN pair; `data-i18n-href` swaps language-dependent link targets (e.g. blog-strip card 4).
- New blog posts: add a `.md` with `blogIndex: true`, run the build, done. Add new URLs to `docs/llms.txt` manually as Markdown links (a bare URL fails Lighthouse's Agentic Browsing audit).
- **Fully bilingual since 2026-07-21:** every SEO page, blog article, and legal page has a German counterpart under `/de/` (same slugs, bidirectional `altPath`). The EN blog index filters `lang === 'en'`; the German blog index lists `/de/blog/*` pages natively (the "Englisch" badge path only fires for EN posts *without* an `altPath` — write both languages for new posts). German legal pages are *generated* markdown (`content/de/legal/`) pairing hand-authored EN `.html` files via a static `altPath` (values ending `.html` skip bidirectional validation); `/impressum.html` is noindex, so `/de/impressum/` deliberately has no `altPath`/hreflang cluster. `i18n.js` loads dictionaries via an absolute `/i18n/` path (`404.html` is served at nested URLs). The landing-page phone mockup, vote chips, and chat bubbles are covered by `data-i18n` keys — keep `index.html` fallback text matching `en.js`.

**Why:** GitHub Pages serves `docs/` directly with no CI — generated output must be committed alongside source changes.

**How to apply:** After editing any content `.md` or `site.css`, run `npm run build:site` (twice — the second run must produce zero git diff) and commit both source and generated files together, after user approval per [[commit-discipline]].
