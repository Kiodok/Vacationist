---
name: german-copy-natural-not-literal
description: Use whenever writing or editing German (`de`) marketing or UI copy for Vacationist — the `/de/` site pages, `docs/i18n/de.js`, `packages/i18n` de locale, any DE string. Write idiomatic German a native speaker would write, never a literal calque of the English. The Tech Lead is a native German speaker and spots translationese instantly.
---

# German copy: natural, not literal

On 2026-09-08 the Tech Lead flagged German I wrote for `/de/features/offline/` as bad —
specifically **"Deine Sitzung wird 7 Tage offline vertraut"**, a word-for-word passive calque of
"Your session is trusted for 7 days offline". The whole page was reworked into natural German.

**Why:** the Tech Lead is a native speaker, the DACH market is a stated priority, and the German
site is meant to read as original copy — not a translation. Translationese hurts the brand with
the exact audience it targets.

## The tells to avoid

| Translationese | Natural |
|---|---|
| passive "wird … vertraut / … gemacht" calquing an EN verb | active with a real subject: "Du bleibst 7 Tage offline angemeldet." |
| reflexive overuse: "die Änderungen senden sich von selbst", "Updates verbinden sich wieder" | "die Änderungen gehen automatisch raus"; "die Verbindung stellt sich wieder her" |
| loan-calques: "stiller Fehlschlag", "ein Handy, das sie trägt", "das Offline-Fenster lang gemacht", "im Ruhezustand verschlüsselt" | "es schlägt nicht unbemerkt fehl"; "ein Handy hat sie schlicht nicht"; "deutlich verlängert"; "verschlüsselt gespeichert" |
| DE/EN word-salad: "fünfstufige Gruppen-Votes", "Live-Salden" | "fünfstufige Gruppenabstimmung", "laufende Salden" |
| translating both halves of an EN phrase: "eine Woche ohne Verbindung offline arbeiten" | "eine Woche lang offline weiterarbeiten" |

Established anglicisms are fine: **Web-App, Tab, Zero-Tap-Anmeldung, Paywall, offline-first**.

## How to apply

- Draft the German *as German*. Then check it against the English for meaning — not by
  translating the English sentence by sentence.
- When unsure whether a phrase is idiomatic, pick the plainer construction.
- Prefer concrete, spoken-register phrasing ("genug für eine zweiwöchige Reise mit einem Funkloch
  mittendrin", "das alte Ärgernis … kann hier nicht passieren").
- Every text change still ships EN + DE together ([[marketing-site-build]]).

See [[marketing-site-build]], [[marketing-growth-plan-q4-2026]].
