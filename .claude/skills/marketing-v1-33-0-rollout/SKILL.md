---
name: marketing-v1-33-0-rollout
description: Use when asked whether vacationist.app reflects current app features, before re-auditing the marketing site for staleness, or when editing marketing copy about expense receipts, the business-expense report, expense categories/settlements, public-transport transfers, flight tickets, or the travel-document access timer. Records the 2026-09-03 content pass that brought the site up to v1.33.0/v1.33.1 and the accuracy rules it used.
---

# Marketing site: v1.33.0 / v1.33.1 rollout (2026-09-03)

The marketing site was brought current with v1.33.0/v1.33.1 on 2026-09-03. As of writing it is
**not committed** — the user reviews and commits, per [[commit-discipline]].

**Why:** commits `c2a7891` + `7221278` + `e5de81d` shipped the largest feature batch since the
SEO pipeline was built, and touched only 3 marketing files (the account-deletion disclosure).
Everything else still described the pre-1.33.0 product — stale `softwareVersion`/`featureList`,
`docs/llms.txt` a 1.26-era description, and comparison tables that silently understated the
product (no false claims, but omissions that are now ties or wins).

## How to apply

**Before claiming the site is stale for v1.33.0, assume it's already been done** — check for
receipts / business-expense / public-transport / settlements copy on `/features/expenses/`,
`/features/transfers/` (a page that now exists), `/use-cases/corporate-offsite-planner/`, and the
5 `/vs/` tables before re-auditing.

**When editing any marketing copy about these features, follow the accuracy rules that were
verified against the migrations — getting them wrong is the easy mistake:**

- Receipts (`expense-documents`) and tickets (`transfer-documents`) live in **private,
  RLS-gated Supabase Storage buckets** served via short-lived signed URLs. They are **NOT**
  "encrypted at rest" / AES-256 / pgcrypto — that story belongs **only** to travel-document text
  fields (name, document number, DOB). Never blur the two into one security claim.
- Upload limits: 10 MB/file; JPEG, PNG, WebP, HEIC, PDF only.
- Public transport (`transfer_public_transport`) has **no voting and no passenger assignment**
  (mirrors rentals). Only **flights** vote. Real segment list:
  `All | Flights | Vehicles | Rentals | PublicTransport` — "Vehicles" (own cars, who rides with
  whom) is distinct from "Rentals".
- Flight tickets: one per (flight, passenger), replaceable, organizer can upload on a
  passenger's behalf. Outbound/return are separate rows, so "per leg" is accurate.
- Business Summary export: Markdown + PDF on web (both download); **PDF only on native** (iOS
  can't present a second share sheet). Receipt links inside it are signed URLs valid **30 days** —
  don't promise a permanent hosted archive.
- Travel-document access timer: countdown starts on the organizer's **first view, per member**;
  runs for the duration the owner chose; hard **7-day** outer deadline if never opened; owner
  sees "Not opened yet"; owner is notified on grant; revocable anytime.
- **No Pro gating** on any v1.33.0 expense or transfer feature — the "free, no ads" framing holds.

**Competitor facts (verified 2026-09-03, will age — re-verify before leaning on them):**
Splitwise receipt scanning is **Pro-only**; Splitwise has **no** business/reimbursement report.
Tricount receipt photos are **free**; Tricount's **CSV/PDF export was deprecated/removed**.

**Pre-existing bug fixed in passing:** `docs/llms.txt` described voting as 4-tier
("must do / like / neutral / group blocker") — the real system is 5-tier
("must do / like / open / skip / group blocker"). Fixed.

**Dead code removed this pass:** `renderGermanBlogIndex()` and its EN-only-post fallback
(`titleDe`/`descriptionDe` + "Englisch" badge) were dead — every blog post now ships in both
languages with a bidirectional `altPath`. Merged into `renderBlogIndex(pages, registry, lang)`;
dropped `STR.de.postBadgeEn`, the `.post-badge` CSS, the unused `postCard()` options, and the
`titleDe`/`descriptionDe` keys from all 7 EN posts. CLAUDE.md's "new blog post" rule now says
write both languages with `altPath`.

## Mechanics touched (so a redo doesn't miss a step)

- `build.mjs`: `APP_VERSION` (feeds `softwareVersion` on every `appLd` page + homepage),
  `APP_LD.{en,de}.{description,featureList,siteDescription}`, `FOOTER_LINKS.product` (added
  `/features/transfers/`), `STR.{en,de}.{ctaText,footerTagline}`, `DE_HOME_LASTMOD`, the
  `STATIC_SITEMAP_ENTRIES` lastmods for `/`, privacy, terms, delete-account, and the
  `renderGermanHome()` FAQ index array `[1..6]` → `[1..7]`.
- Homepage copy: `docs/i18n/{en,de}.js` **both**, the hardcoded EN fallback in `docs/index.html`
  kept matching `en.js`, `CACHE_VER` bump in `docs/i18n.js`. New `.feat-doc-preview` CSS + markup
  in `docs/index.html`; new `doc.1-3.{name,meta}` + `feat.8.{title,desc}` + `faq.7.{q,a}` keys in
  both i18n files (key sets must stay identical — they were 217, now 227).
- Legal: EN legal is **HTML in `docs/`**, DE legal is **Markdown in `content/de/legal/`** — edit
  both, in two formats, and bump the visible "Last updated" line in each.

Cross-refs: [[marketing-site-build]] (pipeline, never hand-edit generated `docs/`),
[[phase10-website]] (original site), [[ios-app-store-rollout]] (Phase 16 CTA decisions).
