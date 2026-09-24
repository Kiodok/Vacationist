# GEO citation register

Internal fact register, **not published anywhere on the site**. Every external
source cited in marketing copy (homepage `#facts` section, `citations:` front
matter, `## Sources` blocks) must have a row here, approved before the copy
ships. See `.claude/skills/seo-aeo-pass-2026-09/SKILL.md` and
`marketing/seo-strategy.md` for the wider GEO pass this belongs to.

**Rules:**
- Primary sources only — legislative text, standards bodies, vendor docs.
  Never a secondary blog, aggregator, or "studies show" statistic.
- One-click verifiable: the quotation below is what a human finds at the URL.
- Nothing ships as copy until the Tech Lead approves this register.
- Re-verify quarterly, alongside the citation audit in `seo-strategy.md` §3.
  A dead link pulls the claim, not a silent keep.
- First-party facts (things only true because Vacationist built them a
  certain way — "no ads", "free") are never listed here; they need no
  external source and nobody should waste time hunting for one.

---

## Approved for use — verified 2026-09-24

### 1. AES-256 encryption

**Claim (as already stated on the site):** "Travel documents are encrypted
at rest with AES-256."

**Source:** NIST FIPS 197, *Advanced Encryption Standard (AES)* — the U.S.
federal standard that defines the AES algorithm.

- EN URL: https://csrc.nist.gov/pubs/fips/197/final
- DE: no official German-language NIST publication exists; cite the EN page
  on `/de/` pages too (do not substitute an unofficial translation).
- Quotation (from the publication landing page): confirms FIPS 197 as the
  current, non-withdrawn standard specifying the AES algorithm (the 2001
  original was withdrawn 2023-05-09 and superseded by FIPS 197-upd1, which
  the CSRC "final" page always points to — no version-drift risk from citing
  the landing page rather than a dated PDF).
- **Placement:** homepage `#facts` row 1, `/features/travel-documents/`,
  `/blog/travel-document-safety-guide/`.

### 2. Encryption as a named GDPR security measure

**Claim:** "Encryption is one of the security measures GDPR names for
protecting personal data" — frames, does not overstate: GDPR does not
*mandate* encryption in every case, it lists it as an appropriate measure.

**Source:** Regulation (EU) 2016/679 (GDPR), Article 32(1)(a).

- EN URL: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- DE URL: https://eur-lex.europa.eu/eli/reg/2016/679/oj/deu
- Quotation (Art. 32(1)(a)): "the pseudonymisation and encryption of
  personal data;" — listed as the first of several example security
  measures a controller/processor may implement, calibrated to risk.
- **Do not write "GDPR requires encryption"** — it requires *appropriate*
  measures and lists encryption as an example, not a mandate. The honest
  phrasing is "GDPR names encryption as an appropriate security measure."
- **Placement:** homepage `#facts` row 2, FAQ "Is Vacationist GDPR
  compliant, and where is my data stored?", `/features/travel-documents/`.

### 3. Trip data stored in Switzerland (Zurich)

**Corrected 2026-09-24 (Tech Lead):** the site previously said "EU (Paris,
France)" — that was wrong. The actual region in use is `eu-central-2`, which
Supabase labels **"Central Europe (Zurich)"** — Switzerland, not an EU
member state. This reverses the "hosting is EU, not Switzerland" framing the
2026-09-20 pass established: hosting is genuinely Swiss. Every "Paris" /
"eu-west-3" / "EU, not Switzerland" instance across the site was swept and
fixed in the same session as this correction — see
`.claude/skills/geo-structure-citations-pass-2026-09-24/SKILL.md` for the
full list of files touched.

**Claim (current):** "Trip data is stored on Supabase infrastructure in
Switzerland (Zurich)."

**Source:** Supabase's own region documentation.

- URL (EN, no separate DE page): https://supabase.com/docs/guides/platform/regions
- Quotation: lists **"Central Europe (Zurich)"** as region `eu-central-2`.
- **Note on GDPR framing:** Switzerland is not an EU member state, so hosting
  location alone doesn't establish GDPR applicability. GDPR may still apply
  to EU users' data under its extraterritorial scope (Art. 3(2)); Swiss
  hosting is separately governed by Swiss data protection law (FADP/nDSG,
  already cited on `/impressum/` for the site operator). Don't assert "GDPR
  compliant because hosted in the EU" — that's no longer even the right
  reasoning shape. The GDPR Art. 32/17 citations below (rows 1B/4) remain
  valid as illustrative statements of what those articles say, independent
  of hosting jurisdiction — not as a claim about which law governs the
  hosting itself. A verified Swiss FADP citation (for encryption/erasure
  articles) was **not** added this pass — no FADP article number has been
  researched and verified yet; do not cite one without doing so first.
- **Placement:** homepage `#facts` row 3, FAQ "Where is my trip data
  stored?", `/about/`.
- **Reminder this citation exists to reinforce:** never write "Swiss
  hosting" — the developer is in Switzerland; the data is in the EU.

### 4. Right to erasure / account deletion

**Claim:** "You can delete your account and your data" — already implemented
via `delete_own_account()` and documented at `/delete-account.html` /
`/de/delete-account/`.

**Source:** GDPR Article 17 (Right to erasure, "right to be forgotten").

- EN URL: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- DE URL: https://eur-lex.europa.eu/eli/reg/2016/679/oj/deu
- Quotation (Art. 17(1) opening clause): "The data subject shall have the
  right to obtain from the controller the erasure of personal data
  concerning him or her without undue delay and the controller shall have
  the obligation to erase personal data without undue delay where one of
  the following grounds applies:"
- **Placement:** homepage `#facts` row 4, FAQ "Where is my trip data
  stored? Is it GDPR compliant?", `/delete-account.html` /
  `/de/delete-account/` (pairs with the D.3 fix giving that DE page a real
  `.lede`).

---

## Explicitly rejected — do not cite

- **Any behavioral/market/usage statistic.** None exist in the codebase.
  Growth Plan Q4 2026 confirms there is no product-usage analytics yet
  (`marketing/growth-plan-2026-q4.md`) — inventing one is the exact failure
  mode this register exists to prevent.
- **The `/about/` "30+ couple and friend trips over three years" line.**
  A first-person founder anecdote, correctly placed on `/about/` as a
  founder story. Do not promote it to a cited statistic or repeat it as a
  "fact" elsewhere — it isn't externally verifiable and was never meant to be.
- **Biometric authentication standards** (Apple `LocalAuthentication` /
  Android `BiometricPrompt`). Considered, left out: the claim on the site
  ("protected by biometric authentication") doesn't need a citation to be
  true or trustworthy — it's a first-party implementation fact, not a claim
  resting on an external authority the way encryption-strength or legal-
  compliance claims do.
