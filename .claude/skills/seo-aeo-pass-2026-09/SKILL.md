---
name: seo-aeo-pass-2026-09
description: Use before editing marketing copy about hosting/privacy/pricing/company/founder, organizationLd()/SAME_AS in marketing/site/build.mjs, the homepage #compare table, or the /pricing/ and /about/ pages. Records the 2026-09-20 SEO+AEO pass and the non-obvious facts it established (sameAs = stores+Reddit only, never pre-announce Pro, founder-story facts, table-sourcing rule). CORRECTED 2026-09-24: hosting is actually Switzerland (Zurich), not the EU — see [[geo-structure-citations-pass-2026-09-24]].
---

# SEO + AEO pass — 2026-09-20

Staged (not committed) pass on vacationist.app. Full record: `marketing/seo-strategy.md` → "Shipped 2026-09-20". Plan: `~/.claude/plans/peppy-plotting-treasure.md`.

**Followed up by [[geo-structure-citations-pass-2026-09-24]]** — homepage answer-passage structure (#glossary/#fit/#facts, FAQ 7→12), a citation register, and `DefinedTermSet` schema. Read that skill too if you're touching the homepage.

## Facts a future session must not get wrong

- **CORRECTED 2026-09-24 (Tech Lead): "Built in Switzerland" = hosted in Switzerland too.** This entry used to say hosting was in the EU (Paris, `eu-west-3`) and warned never to write "Swiss hosting" — that was wrong. The actual Supabase region is `eu-central-2`, labelled "Central Europe (Zurich)" — Switzerland, not an EU member state. Developer AND hosting are both in Switzerland; lead with that plainly. GDPR may still apply separately to EU users' data (extraterritorial scope, Art. 3(2)), and Swiss law (FADP/nDSG, already cited on `/impressum/`) governs the hosting itself — don't claim "GDPR compliant because hosted in the EU," that reasoning no longer applies. Full correction + every file touched: [[geo-structure-citations-pass-2026-09-24]].
- **`sameAs` = App Store + Play + web app + Reddit** (`https://www.reddit.com/user/vacationist-app/`, confirmed 2026-09-20). Instagram / Product Hunt / LinkedIn are not listed — only Reddit exists so far. Add a profile to `SAME_AS` in `marketing/site/build.mjs` only after the Tech Lead confirms its exact URL; never list an unconfirmed one.
- **Never pre-announce a Pro tier anywhere** (Tech Lead decision, 2026-09-20). `/pricing/` = present-tense facts only (free, no ads, no paid tier).
- **Founder story on `/about/` (EN+DE, first person, section "Why we built it"):** built with the Tech Lead's wife after 30+ couple/friend trips in 3 years, all organized by them (searching places, booking stays and flights, planning activities); before Vacationist: chaotic WhatsApp chats, documents on a local PC, tickets scattered across phones, to-dos in Todoist; features grew out of using the app on their last several trips with friends; now everything is in one place. **Use only these facts** — no invented destinations, quotes or motivation. **No third-person pronouns for the Tech Lead** (none stated): copy says "Gary's wife" / "Garys Frau".
- **Homepage `#compare` table is sourced only from the `/vs/` pages' own tables.** Add a row only if it appears (and is checked) in all three compared apps' tables — competitor cells are claims about third parties.
- **Rich results:** Google restricts `FAQPage` rich results to authoritative gov/health sites (Aug 2023) and removed `HowTo` rich results entirely. Both stay as answer-engine extraction assets; never describe them as SERP wins.
- **German terms to reuse:** the top vote tier is **"Gruppen-Blocker"** (Tech Lead decision 2026-09-20; matches the app's `packages/i18n/src/locales/de/tutorial.json`; the app's vote chip label is just "Blocker"). The site's old term "Gruppenhindernis" was replaced everywhere — never reintroduce it. Other tiers: "Muss sein / Gefällt mir / Offen / Auslassen". Settle-up = "Ausgleichsplan", at-rest = "im Ruhezustand … verschlüsselt". "Blocker" is masculine ("der Gruppen-Blocker"); the old term was neuter — check articles if it's ever used unquoted.

## Build mechanics added

- `organizationLd()` / `personLd()` / `homePageLd()` / `howToLd()` in `build.mjs`; the homepage's SoftwareApplication, WebSite, WebPage, Organization and HowTo blocks are **build-owned** (edit them in `build.mjs`, not `docs/index.html`). Only `FAQPage` is hand-authored, and must match the `faq.N.q/a` keys.
- `replaceLdBlock()` **throws** if a block is missing (no silent no-op). Block objects must list `@context` then `@type` first.
- `extractListItems()` → `ItemList` for `type: listicle` pages; `extractHowToSteps()` → `HowTo` for pages with `howTo: true` and `## Phase N:` headings; `orgLd: true` front matter emits the Organization block (used by `/about/`).
- `renderGermanHome()` derives its FAQ list from `faq.N.q` keys and reads `meta.keywords` from `de.js` (both were hardcoded).
- Verify with two `npm run build:site` runs and a full-`docs/`-tree hash (PNGs included) — the second must be byte-identical.

**Why:** these are decisions/facts that would otherwise be re-derived wrongly (the hosting-location fact was itself wrong once — see the correction above — don't let it flip back).
**How to apply:** read this before touching the areas in the description. Related: [[marketing-site-build]], [[german-copy-natural-not-literal]], [[marketing-growth-plan-q4-2026]], [[commit-discipline]].

**Not verified:** the new homepage sections were never viewed in a browser (extension not connected). Check `/` and `/de/` at desktop + phone width — especially the comparison table's horizontal scroll and the pill rows.
