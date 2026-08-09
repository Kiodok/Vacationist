---
title: Datenschutzerklärung — Vacationist
description: Datenschutzerklärung für Vacationist — wie wir personenbezogene Daten in unserer kollaborativen Reiseplanungs-App erheben, nutzen und schützen.
path: /de/privacy-policy/
lang: de
type: legal
schema: WebPage
date: 2026-08-09
altPath: /privacy-policy.html
breadcrumbLabel: Datenschutz
---

# Datenschutzerklärung

*Gültig ab: 1. Juni 2026 · Zuletzt aktualisiert: 9. August 2026*

## 1. Wer wir sind

Vacationist wird als persönliches Nebenprojekt von **Gary Lude** mit Sitz in der Schweiz betrieben (nachfolgend „wir", „uns" oder „der Entwickler").

Kontakt: [meetdeep.de@gmail.com](mailto:meetdeep.de@gmail.com)

Diese Datenschutzerklärung gilt für die Vacationist-Mobil-App („die App"), erhältlich im Google Play Store, und für die Vacationist-Website unter [vacationist.app](https://vacationist.app) („die Website").

## 2. Welche Daten wir erheben

Wir erheben nur die Daten, die zur Bereitstellung des Dienstes erforderlich sind.

**Kontoinformationen**

- Name und E-Mail-Adresse (über Google Sign-In oder Magic Link bereitgestellt)
- Google-Profilbild (optional, nur bei Anmeldung mit Google)
- Bevorzugte Sprache und Zeitzone (beim Onboarding festgelegt)

**Reise- & Planungsdaten**

- Reisenamen, Termine, Ziele und Mitgliederlisten
- Aktivitäten, Stimmen, Ausgaben, Einkaufslisten, Notizen, Unterkünfte und Transferdaten, die du erstellst
- Chat-Nachrichten innerhalb einer Reise (verschlüsselt gespeichert, siehe unten)
- Einladungslinks, die du erzeugst oder verwendest

**Reisedokumente**

> Die von dir eingegebenen Reisedokument-Daten (vollständiger Name, Dokumentnummer, Geburtsdatum sowie etwaige Notizen) werden verschlüsselt in unserer Datenbank gespeichert. Staatsangehörigkeit, ausstellendes Land und Ablaufdatum werden unverschlüsselt gespeichert, da sie für Erinnerungen benötigt werden und für sich allein nicht zur Identifikation eines Dokuments ausreichen. Der Zugriff ist durch Row-Level-Security und, auf dem Smartphone, durch eine biometrische Sperre oder Geräte-PIN geschützt. Der Verschlüsselungscode wird von uns verwaltet, nicht aus deinem Gerät oder deiner Biometrie abgeleitet — wir könnten technisch auf diese Daten zugreifen, tun dies aber nur protokolliert und im notwendigen Umfang. Chat-Nachrichten werden mit demselben Verfahren verschlüsselt gespeichert.

**Gerätedaten**

- Push-Benachrichtigungs-Token (um dir In-App-Benachrichtigungen zu senden; gespeichert, bis du dich abmeldest oder die App deinstallierst)
- IP-Adresse (auf Netzwerkebene von der Supabase-Infrastruktur erfasst; wird von uns nicht in Anwendungsdaten gespeichert)

**Website-Analyse- & Werbemessdaten**

Beim Besuch der Website erfassen Google Analytics 4 und das **Reddit-Pixel** automatisch die folgenden Daten über Cookies und ähnliche Technologien — jedoch erst, nachdem du im Cookie-Banner aktiv zugestimmt hast:

- Besuchte Seiten, Verweildauer und Navigationspfad
- Verweisende Website oder Suchanfrage, über die du die Website gefunden hast
- Browsertyp, Betriebssystem und Gerätekategorie
- Ungefährer Standort (nur auf Länder- und Stadtebene — abgeleitet aus einer gekürzten IP-Adresse; die vollständige IP-Adresse wird von Google Analytics, von Reddit oder von uns **niemals gespeichert**)
- Sitzungs- und Nutzerzahlen über anonymisierte Kennungen in First-Party-Cookies (`_ga`/`_ga_*`) sowie Reddits eigenem `_rdt_uuid`-Cookie
- Falls du über eine Reddit-Anzeige gekommen bist: eine von Reddit erzeugte Klick-Kennung — genutzt ausschliesslich zur Messung, ob diese Anzeige zu einer App-Installation oder Anmeldung geführt hat, niemals zum Profiling

Zusätzlich betreiben wir eine eigene, minimale Analyse-Erfassung für denselben Zweck (Verständnis, welche Marketingkanäle zu Anmeldungen führen). Diese speichert bewusst **niemals eine IP-Adresse** — siehe „Unsere eigene Analyse" in Abschnitt 6.

Diese Daten werden nur auf der Website erhoben, nicht durch etwas, das in die Mobil-App eingebettet ist. Installierst du die App jedoch nach dem Klick auf eine Reddit-Anzeige und meldest dich an, wird eine einzelne Anmeldebestätigung — mit derselben Klick-Kennung, falls vorhanden — von unserem Server an Reddit übermittelt. Siehe „Zuordnung von App-Installationen (Conversions API)" in Abschnitt 6.

## 3. Wie wir deine Daten nutzen

- Zur Erstellung und Pflege deines Kontos
- Zur Bereitstellung der kollaborativen Reiseplanungs-Funktionen der App
- Zum Versand von Push-Benachrichtigungen über Aktivitäten in deinen Reisen (nur mit Erlaubnis deines Geräts)
- Zur sicheren Authentifizierung (über Supabase Auth)
- Um zu verstehen, wie Besucher die Website nutzen, damit wir Inhalte und Performance verbessern können (über Google Analytics und unsere eigene Analyse-Erfassung)
- Um zu messen, ob unsere eigenen Werbekampagnen (derzeit: Reddit Ads) wirksam sind — beschränkt auf die Frage, ob ein Klick auf eine unserer Anzeigen zu einem Website-Besuch, einer App-Installation oder einer Anmeldung geführt hat (über das Reddit-Pixel und die Conversions API, siehe Abschnitt 6)

Wir verkaufen deine Daten nicht und erstellen keine dienstübergreifenden Werbeprofile oder nutzen deine Daten, um dich auf anderen Diensten mit Werbung anzusprechen. Wir nutzen deine Daten nicht für allgemeines Profiling oder Marketing über den oben beschriebenen, eng begrenzten Werbemesszweck hinaus.

## 4. Datenspeicherung & Sicherheit

Deine Daten werden auf Servern von **Supabase Inc.** gespeichert, gehostet in der EU (Paris, Frankreich, AWS-Region eu-west-3). Supabase Inc. ist ein US-Unternehmen; da von den USA aus grundsätzlich auf die EU-gehosteten Daten zugegriffen werden könnte, stützt sich diese Übermittlung auf Standardvertragsklauseln. Die Datenschutzerklärung von Supabase ist unter [supabase.com/privacy](https://supabase.com/privacy) abrufbar.

Alle Daten werden über TLS übertragen. Reisedokumente und Chat-Nachrichten werden auf Datenbankebene verschlüsselt, bevor sie gespeichert werden; was „verschlüsselt" in der Praxis bedeutet, steht im Abschnitt Reisedokumente oben.

Die Authentifizierung übernimmt Supabase Auth. Google-Sign-In-Tokens werden serverseitig ausgetauscht und von uns nicht gespeichert.

## 5. Drittanbieter-Dienste

- **Supabase** — Datenbank, Authentifizierung, Dateispeicher, Edge Functions ([Datenschutzerklärung](https://supabase.com/privacy))
- **Google Sign-In (Google LLC)** — optionale Anmeldemethode ([Datenschutzerklärung](https://policies.google.com/privacy))
- **Expo (Expo Inc.)** — Zustelldienst für Push-Benachrichtigungen ([Datenschutzerklärung](https://expo.dev/privacy))
- **Sentry (Functional Software Inc.)** — Absturz- und Fehlerberichte, verknüpft mit deiner Konto-ID; enthält eine maskierte Stichprobe der Sitzungsaktivität und kann einen Screenshot zum Zeitpunkt eines Absturzes enthalten ([Datenschutzerklärung](https://sentry.io/privacy/))
- **Google Analytics 4 (Google LLC)** — Website-Nutzungsstatistiken, nur mit deiner Einwilligung geladen (nur Website, siehe Abschnitt 6) ([Datenschutzerklärung](https://policies.google.com/privacy))
- **Reddit, Inc.** — Werbemessung: das Reddit-Pixel auf der Website (nur mit deiner Einwilligung geladen) sowie serverseitige Anmeldezuordnung über die Reddit Conversions API, wenn die App nach dem Klick auf eine Reddit-Anzeige installiert wird — siehe Abschnitt 6 ([Datenschutzerklärung](https://www.redditinc.com/policies/privacy-policy))
- **GitHub (Microsoft Corporation)** — hostet diese Website und verarbeitet Besucheranfragen und IP-Adressen auf Infrastrukturebene ([Datenschutzhinweis](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement))
- **Vercel Inc.** — hostet die Web-Version der App unter web.vacationist.app und stellt anonymisierte Analyse- und Performance-Daten ausschliesslich innerhalb der Web-Version bereit ([Datenschutzerklärung](https://vercel.com/legal/privacy-policy))
- **Cloudflare, Inc.** — Bot- und Missbrauchsschutz (Turnstile, läuft unsichtbar im Hintergrund) bei ausgewählten Formularen, gemäß Cloudflares [Turnstile-Datenschutzzusatz](https://www.cloudflare.com/turnstile-privacy-policy/) und [Datenschutzerklärung](https://www.cloudflare.com/privacypolicy/)

## 6. Analyse & Cookies

**Was wir einsetzen**

Die Website nutzt **Google Analytics 4**, einen Webanalysedienst der Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA („Google"). Google Analytics setzt First-Party-Cookies (`_ga`, `_ga_*`) in deinem Browser, um Besucher zu unterscheiden und die Nutzung der Website zu messen.

**IP-Anonymisierung**

Google Analytics 4 kürzt IP-Adressen, bevor Daten auf Googles Server geschrieben werden. Deine vollständige IP-Adresse wird nie gespeichert und uns nie zugänglich gemacht. Der aus der gekürzten Adresse abgeleitete ungefähre Standort ist auf Länder- und Stadtebene beschränkt.

**Einwilligung**

Google Analytics wird geladen und die Cookies `_ga`/`_ga_*` werden gesetzt **erst, nachdem du im Cookie-Banner beim ersten Besuch aktiv zugestimmt hast** (Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO / § 25 Abs. 1 TTDSG, soweit anwendbar; Art. 6 DSG für Besucher aus der Schweiz). Lehnst du ab oder triffst du keine Wahl, wird Google Analytics nicht geladen und es wird kein Analyse-Cookie gesetzt. Du kannst deine Wahl jederzeit über [Cookie-Einstellungen](#cookie-settings) in der Fusszeile überprüfen oder widerrufen. Wir nutzen Google Analytics nicht, um persönliche Profile zu erstellen oder Einzelpersonen anzusprechen.

**Internationale Datenübermittlung**

Google LLC hat ihren Hauptsitz in den USA. Von Google Analytics erfasste Daten werden auf Googles Server in den USA übertragen und dort verarbeitet. Diese Übermittlung erfolgt auf Grundlage der von der Europäischen Kommission genehmigten und vom Schweizer EDÖB anerkannten Standardvertragsklauseln (SCCs) sowie Googles Teilnahme am Swiss-US Data Privacy Framework. Googles Schutzmassnahmen für Datenübermittlungen: [business.safety.google/gdprreference](https://business.safety.google/gdprreference/).

**Aufbewahrung**

Analytics-Ereignisdaten werden in Google Analytics **2 Monate** aufbewahrt (der kürzeste konfigurierbare Zeitraum). Aggregierte Berichte können unbegrenzt aufbewahrt werden, enthalten aber keine personenbezogenen Daten.

**Widerspruchsmöglichkeiten**

Du hast folgende Möglichkeiten, die Datenerfassung durch Google Analytics zu verhindern oder zu beenden:

- Ablehnung oder späterer Widerruf über [Cookie-Einstellungen](#cookie-settings) in der Fusszeile
- Installation des [Google Analytics Opt-out Browser-Add-ons](https://tools.google.com/dlpage/gaoptout)
- Aktivierung von „Do Not Track" oder Global Privacy Control (GPC) in deinem Browser
- Nutzung einer Browser-Erweiterung, die Analyse-Skripte blockiert
- Verwaltung deiner Google-Dateneinstellungen unter [myaccount.google.com](https://myaccount.google.com/data-and-privacy)

Deine Cookie-Wahl wird im lokalen Speicher deines Browsers (Schlüssel `v_consent`) bis zu 12 Monate lang gespeichert; danach wirst du erneut gefragt. Dieser Speichereintrag selbst ist technisch notwendig, um deine Wahl zu merken, und erfordert keine Einwilligung.

**Reddit-Pixel**

Die Website ([vacationist.app](https://vacationist.app)) und die Web-Version der App (web.vacationist.app) nutzen das **Reddit-Pixel**, ein Werbemesswerkzeug von Reddit, Inc., 548 Market St, San Francisco, CA 94104, USA („Reddit"). Es setzt ein First-Party-Cookie (`_rdt_uuid`) und liest, falls du über eine Reddit-Anzeige gekommen bist, die von Reddit erzeugte Klick-Kennung aus der Seiten-URL. Dies dient ausschliesslich der Messung, ob unsere Reddit-Werbekampagnen zu Website-Besuchen, App-Installationen oder Anmeldungen führen — niemals der Erstellung eines Profils deines Surfverhaltens darüber hinaus.

Wie Google Analytics wird das Reddit-Pixel geladen — und das `_rdt_uuid`-Cookie gesetzt — **erst, nachdem du im Cookie-Banner aktiv zugestimmt hast** (Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO / § 25 Abs. 1 TTDSG, soweit anwendbar; Art. 6 DSG für Besucher aus der Schweiz). Eine einzige Annahme/Ablehnung deckt sowohl Google Analytics als auch das Reddit-Pixel ab. Lehnst du ab, oder widerrufst du deine Einwilligung später über [Cookie-Einstellungen](#cookie-settings), wird keines von beiden geladen bzw. beide werden entfernt.

Reddit, Inc. ist ein US-Unternehmen; die unten beschriebene Conversions-API-Übermittlung sowie Pixel-Daten werden auf Reddits Servern in den USA verarbeitet, auf Grundlage von Standardvertragsklauseln. Reddits Datenpraktiken sind beschrieben unter [redditinc.com/policies/privacy-policy](https://www.redditinc.com/policies/privacy-policy).

**Zuordnung von App-Installationen (Conversions API)**

In der Mobil-App selbst ist kein Reddit-SDK und kein Reddit-Pixel eingebettet. Klickst du stattdessen auf eine Reddit-Anzeige, wird die Klick-Kennung vorübergehend in den Google-Play-Installationslink codiert, auf dem du landest. Meldest du dich in der App zum ersten Mal an, liest unser Server (nicht Reddit) diese Kennung — falls vorhanden — über den eigenen Installations-Referrer-Mechanismus des Play Stores aus und übermittelt eine einzelne Anmeldebestätigung zusammen mit der Klick-Kennung über die Conversions API an Reddit. Hast du die App ohne Klick auf eine Reddit-Anzeige installiert, gibt es keine Klick-Kennung, und es wird nichts an Reddit übermittelt — deine Anmeldung wird trotzdem in unserer eigenen Analyse-Erfassung unten erfasst, jedoch nur als nicht zugeordnetes (organisches) Ereignis.

**Unsere eigene Analyse**

Neben Google Analytics und dem Reddit-Pixel betreiben wir eine kleine, eigene Analyse-Erfassung auf unserer eigenen Infrastruktur, die Website-Seitenaufrufe, Klicks auf die Play-Store-/Web-App-Links sowie App-Anmeldungen erfasst. Sie existiert nur, damit wir denselben Marketing-Trichter, den uns Google Analytics und Reddit zeigen, an einem Ort sehen können, unabhängig von beiden.

Sie speichert bewusst weniger als ein typisches Analyse-Tool: **es wird niemals eine IP-Adresse gespeichert**, weder vollständig noch gekürzt. Wo eine grobe Besucherkennung nötig ist, um denselben Besuch nicht doppelt zu zählen, berechnen wir einen Einweg-Hash aus deiner IP-Adresse, deinem Browser und einem geheimen, täglich wechselnden Salt — deine IP-Adresse selbst wird nur für diesen Moment verwendet und niemals in eine Datenbank geschrieben. Wir speichern: den Seitenpfad, die Reddit-Klick-Kennung und Kampagnenparameter, falls vorhanden, die Domain der verweisenden Seite (nicht die vollständige URL), den User-Agent-String deines Browsers sowie — nur bei Anmeldungen — dass eine Anmeldung stattgefunden hat und, falls zutreffend, dieselbe an Reddit übermittelte Klick-Kennung.

Wie bei Google Analytics und dem Reddit-Pixel wird nichts erfasst, bevor du im Cookie-Banner auf der Website zugestimmt hast. Diese Erfassung wird **14 Monate** lang aufbewahrt, danach werden Einträge automatisch gelöscht.

> Weder Google Analytics noch das Reddit-Pixel noch ein anderes Drittanbieter-Analyse-SDK ist in die native Mobil-App (iOS/Android) eingebettet. Die Web-Version der App unter web.vacationist.app hat ein eigenes, separates Cookie-Consent-Banner für das Reddit-Pixel und unsere eigene Analyse-Erfassung (beide oben beschrieben) und nutzt das datenschutzfreundliche Vercel Analytics zur anonymisierten Performance-Messung — siehe Abschnitt 5. Das Einzige, was bei einer App-Anmeldung an Reddit übermittelt wird, ist die eine, serverseitige Conversions-API-Meldung wie oben beschrieben — niemals eine rohe IP-Adresse, und niemals mehr, als zur Bestätigung dieser einen Anmeldung nötig ist.

## 7. Aufbewahrungsdauer

Deine Daten werden so lange aufbewahrt, wie dein Konto besteht. Wenn du dein Konto löschst, werden deine direkt zugeordneten personenbezogenen Daten — Anmeldeidentität, Name, E-Mail-Adresse, Profilbild, Push-Tokens, Reisedokumente, Stimmen und Benachrichtigungen — sofort gelöscht; Datenbank-Backups laufen innerhalb von 30 Tagen aus. Da Vacationist kollaborativ ist, werden Inhalte, die du innerhalb einer gemeinsamen Reise erstellt hast (Aktivitäten, Ausgaben, Notizen, Chat-Nachrichten und Ähnliches), **nicht** zusammen mit deinem Konto gelöscht — sie bleiben für die anderen Mitglieder dieser Reise sichtbar, zugeordnet zu einem generischen „Gelöschter Nutzer" ohne Verknüpfung zu dir. Warst du das einzige Mitglied einer Reise, wird diese Reise zusammen mit deinem Konto gelöscht. Die vollständige Aufschlüsselung, was gelöscht und was aufbewahrt wird, sowie wie du die Löschung beantragst, findest du unter [Konto löschen](/de/delete-account/).

Gast-Konten (über Einladungslink erstellt, ohne E-Mail-Adresse), die nie in ein vollwertiges Konto umgewandelt werden, können nach einer Phase der Inaktivität gelöscht werden; dies ist derzeit kein automatisierter Vorgang. Mit einem Gast-Konto verknüpfte Daten werden nur so lange aufbewahrt, wie das Konto besteht.

## 8. Deine Rechte

Nach dem Schweizer Datenschutzgesetz (DSG) und, soweit anwendbar, der EU-Datenschutz-Grundverordnung (DSGVO) hast du folgende Rechte:

- **Auskunftsrecht** — du kannst eine Kopie der über dich gespeicherten personenbezogenen Daten anfordern
- **Recht auf Berichtigung** — du kannst unrichtige Daten jederzeit über den Profil-Bildschirm korrigieren
- **Recht auf Löschung** — du kannst die Löschung deines Kontos und deiner direkt zugeordneten Daten jederzeit verlangen; siehe [Konto löschen](/de/delete-account/) für den Ablauf und dafür, was auf gemeinsamen Reisen anonymisiert erhalten bleibt
- **Recht auf Datenübertragbarkeit** — auf Anfrage stellen wir dir deine Daten in einem strukturierten, gängigen Format zur Verfügung. Die App bietet derzeit keinen vollständigen Selbstbedienungs-Export über alle Datenkategorien hinweg; ein Übersichts-Export pro Reise ist direkt in der Reise verfügbar, alles Weitere stellen wir auf Anfrage manuell zusammen
- **Widerspruchsrecht** — du kannst der Verarbeitung widersprechen, soweit wir uns auf berechtigtes Interesse stützen

Zur Ausübung dieser Rechte kontaktiere uns unter [meetdeep.de@gmail.com](mailto:meetdeep.de@gmail.com). Wir antworten innerhalb von 30 Tagen.

## 9. Datenschutz von Kindern

Die App richtet sich nicht an Kinder unter 13 Jahren. Wir erheben wissentlich keine Daten von Kindern unter 13. Wenn du glaubst, dass ein Kind uns personenbezogene Daten übermittelt hat, kontaktiere uns bitte — wir löschen sie umgehend.

## 10. Änderungen dieser Erklärung

Wir können diese Erklärung von Zeit zu Zeit aktualisieren. In diesem Fall ändert sich das Datum „Zuletzt aktualisiert" oben auf dieser Seite. Über wesentliche Änderungen informieren wir per In-App-Benachrichtigung. Die weitere Nutzung der App nach Änderungen gilt als Zustimmung zur aktualisierten Erklärung.

## 11. Kontakt

Für Fragen, Datenanfragen oder Beschwerden erreichst du den Entwickler unter: [meetdeep.de@gmail.com](mailto:meetdeep.de@gmail.com)

Wenn du mit unserer Antwort unzufrieden bist, hast du das Recht, Beschwerde beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) einzureichen: [www.edoeb.admin.ch](https://www.edoeb.admin.ch).
