---
name: em-dash-hyphen-sweep
description: Use before touching marketing site copy, docs/i18n/{en,de}.js, marketing/site/build.mjs string literals, or any marketing/site/content/**/*.md — explains the 2026-10-04 em-dash-to-hyphen pass and its scope rules, so a future edit doesn't reintroduce em dashes inconsistently.
---

# Em dash → hyphen sweep (2026-10-04)

On 2026-10-04 the Tech Lead asked to replace every "—" with "-" across the whole marketing site
(not just the landing page), because em dashes read as an AI-writing tell. Scope rules actually
applied, which matter for any future copy edit in this area:

- **English: literal 1:1 character swap everywhere**, including matched-pair parentheticals and
  the four external citation titles in `#facts` (`fact.N.src` / `citations:` front matter).
- **German homepage genuinely recast, not swapped.** `docs/i18n/de.js` and the DE strings in
  `marketing/site/build.mjs` that feed the homepage specifically (`APP_LD.de`, `HOWTO_LD.de`,
  `ratingProofText('de')`) were rewritten with commas/colons/parentheses — a bare hyphen is not
  standard German typography and reads sloppy to a native speaker. `marketing/site/build.mjs`'s
  `STR.de` (footer/CTA strings, sitewide not homepage-only) and all DE content Markdown
  (`marketing/site/content/de/**/*.md`, including legal pages) got the same mechanical swap as
  English — recasting ~700 lines of prose was explicitly ruled out as too costly for the value.
- **Legal/policy pages and the consent banner are in scope**, dash-character-only, no rewording,
  in either language (`docs/privacy-policy.html` etc., `marketing/site/consent.js`'s `COPY` table).
- **Code comments are untouched everywhere** — developer-facing, and em dashes are the established
  house style in this repo's comments/CLAUDE.md/engineering docs. Also untouched: the three
  em-dash-as-delimiter regexes (`page.title.split(/[:|—|]/)`) in `build.mjs:718`, `build.mjs:909`,
  `og-image.mjs:83` — all three are dead fallbacks (every content page sets `breadcrumbLabel:`) and
  adding `-` to that character class would wrongly split on hyphens inside words like
  "Gruppenreise-Planer".
- `docs/llms.txt` is hand-maintained (not generated) and was swept directly. `docs/llms-full.txt`
  is generated, but its wrapper prose lives as template literals inside `renderLlmsFull()` /
  `homeMarkdown()` in `build.mjs` (not just concatenated content) — those template strings needed
  direct edits too, since regenerating from already-fixed content alone wouldn't touch them.
- Bumped `CACHE_VER` in `docs/i18n.js` (`docs/i18n/*.js` changed).

**Why:** Visitor-facing copy quality / brand voice call from the Tech Lead, not a bug fix.

**How to apply:**
- Any new homepage copy added to `docs/i18n/de.js` should be written dash-free in natural German
  from the start (don't introduce a fresh em dash then rely on a future sweep).
- Any new DE content Markdown page can use "—" normally — it only gets mechanically swapped if
  another sweep happens.
- Citation titles in `fact.N.src` / `citations:` front matter must stay byte-identical across all
  copies (`en.js`, `de.js`, and the 4 `content/{,de/}features|blog/travel-document*.md`
  front-matter duplicates) — `build.mjs` itself notes this triple-sync has no test guarding it.
- See [[no-branches-main-only]] and [[feedback_commits]]/`commit-discipline` for how this lands.
- See [[german-copy-natural-not-literal]] for the general rule this recast followed.

**Not yet done (flagged, not executed):** `play-store/listing.md` (25 em dashes) and
`marketing/product-hunt-launch.md` / `social-media/**` (baked PNGs/video) still use em dashes.
`product-hunt-launch.md` states every claim on those assets mirrors the site, so store/PH copy now
reads inconsistently in voice until it gets its own pass — ask the Tech Lead before touching baked
creative assets.

**Status as of 2026-10-04:** Code-complete, verified, **not committed** (user tests first).
`npm run build:site` run twice produced zero diff; `npm run test:site` and
`node marketing/site/consent.test.js` both pass in full (including the DE-leak-into-EN-homepage
check); a residual `grep -rn "—" docs/` sweep returns only code comments and `robots.txt` comments.
Spot-checked via `npm run serve:docs` + `curl` (the Claude-in-Chrome extension was not connected
this session, so the usual click-through could not run — worth doing before/at commit time).

**Regression guard added the same day:** CLAUDE.md now has a "No em dashes in visitor-facing copy"
rule (Marketing Site → Rules), and `marketing/site/site.test.js` has an automated "Em dash guard"
check wired into `npm run test:site` — it scans every generated/hand-authored HTML page's visible
text (stripping `<script>`/`<style>`/`<!-- -->` but keeping JSON-LD in scope) plus `docs/llms.txt`
and `docs/llms-full.txt` whole, and fails the build if any em dash shows up outside the exempted
code-comment surfaces. Verified it actually catches a regression (injected a test em dash into a
content `.md` file and a `docs/i18n/*.js` string — both failed the check as expected, then
reverted). This means a future accidental em dash in visitor-facing copy fails `npm run test:site`
rather than requiring another manual sweep.
