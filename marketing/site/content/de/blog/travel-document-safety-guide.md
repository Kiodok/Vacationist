---
title: Musst du dein Passfoto wirklich in den Gruppenchat schicken?
description: Der übliche Weg, wie Gruppenreisen Reisedokumente teilen — Chat-Screenshots, Fotoalben — ist der unsicherste. So funktioniert Verschlüsselung „at rest" wirklich, und so macht man es richtig.
path: /de/blog/travel-document-safety-guide/
lang: de
type: article
schema: BlogPosting
date: 2026-08-05
altPath: /blog/travel-document-safety-guide/
keywords: Reisedokumente sicher teilen, verschlüsselte Passspeicherung, Reisedokument App, Passfoto Gruppenchat Risiko
blogIndex: true
related: /de/features/travel-documents/, /de/use-cases/family-reunion-planner/, /de/blog/how-to-plan-a-group-trip/
breadcrumbLabel: Reisedokumente sicher teilen
---

# Musst du dein Passfoto wirklich in den Gruppenchat schicken?

<p class="lede">Es passiert bei fast jeder Gruppenreise: Für eine Buchung werden die Passdaten aller gebraucht, also kommt beim Abendessen ein Handy raus und Passfotos landen nacheinander im Gruppenchat. Niemand denkt sich dabei etwas — bis man tatsächlich darüber nachdenkt, wo diese Fotos landen.</p>

## Was Gruppenreisen wirklich geteilt werden muss

Gruppenbuchungen brauchen tatsächlich öfter Dokumentendaten, als man denkt. Eine Ferienwohnung in der EU will die Passnummer jedes Gastes für das lokale Meldewesen. Eine Flugbuchung mit mehreren Namen braucht die vollständigen rechtlichen Namen und Geburtsdaten exakt wie im Pass. Manche Reiseziele verlangen einen Versicherungsnachweis vor dem Check-in, und einige fragen noch nach Impfnachweisen. Das ist kein Papierkram, den der Organisator übertrieben genau nimmt — es ist das, was die Buchung tatsächlich verlangt.

Das Problem war nie, *ob* diese Angaben geteilt werden. Es war immer *wie*.

## Das übliche schlechte Muster

Drei Wege, wie das normalerweise abläuft — und warum jeder davon schlimmer ist, als er aussieht:

- **Chat-Screenshots.** Sobald ein Passfoto im Gruppenchat landet, existiert es dauerhaft auf jedem Handy aller Mitglieder, in jedem Chat-Backup des Geräts (iCloud, Google Drive, WhatsApps eigenes Backup) und in jeder Cloud-Synchronisierung, die diese Backups speist. Niemand „besitzt" das Foto mehr in irgendeinem sinnvollen Sinn — es ist über zehn und mehr Geräte und Backups kopiert, unverschlüsselt, ohne Möglichkeit zu wissen, wer es seither tatsächlich gesehen hat.
- **Geteilte Fotoalben.** Etwas organisierter, strukturell identisch. Ein geteiltes Album mit „Dokumente" im Namen ist immer noch eine unverschlüsselte Sammlung von Passfotos, die jedes Mitglied screenshotten, weiterleiten oder versehentlich auf einem geteilten oder verlorenen Gerät offen lassen kann.
- **E-Mail-Anhänge.** Der Organisator sammelt die Passfotos aller per E-Mail, um sie an die Buchungsplattform weiterzuleiten. Jetzt existieren die Dokumente unbegrenzt im Posteingang des Organisators, in welchem Speicher auch immer der E-Mail-Anbieter nutzt, plus eine Kopie im System der Buchungsplattform — ein Dritter, dem der Reisende nie direkt vertraut hat.

Der gemeinsame Nenner bei allen drei: Sobald ein Passfoto verschickt ist, gibt es keine Möglichkeit, es zurückzuholen, keine Verschlüsselung, die es im Ruhezustand schützt, und keine Möglichkeit, den Zugriff später zu widerrufen — etwa, wenn diese Person die Reise verlässt oder die Reise vorbei ist und es keinen Grund mehr gibt, dass irgendjemand es noch hat.

## Was „verschlüsselt gespeichert" wirklich bedeutet

„Verschlüsselt gespeichert" wird gerne als Feature-Stichpunkt hingeworfen, also hier, was es tatsächlich in einfachen Worten bedeutet: Das Dokument wird gar nicht als betrachtbares Foto gespeichert. Es wird als verschlüsselte Daten gespeichert, die ohne den richtigen Schlüssel mathematisch unbrauchbar sind — und dieser Schlüssel existiert nur auf deinem Gerät, entsperrt durch deine Biometrie (Fingerabdruck oder Gesicht), nicht auf irgendeinem Server, der auf ein Datenleck wartet.

Konkret bei Vacationist: Wenn du einen Pass oder Ausweis zu deinem [verschlüsselten Reisedokumenten-Tresor](/de/features/travel-documents/) hinzufügst, wird er mit AES-256 verschlüsselt — demselben Verschlüsselungsstandard, der für als geheim eingestufte Regierungsdaten genutzt wird —, bevor er dein Gerät überhaupt verlässt. Niemand, auch Vacationist nicht, kann das Rohdokument ohne die biometrische Entsperrung deines Geräts einsehen. Das ist ein strukturell anderes Versprechen als „wir schauen versprochen nicht rein", was du tatsächlich bei einem Chat-Screenshot oder E-Mail-Anhang voraussetzt.

## Wie temporärer, widerrufbarer Organisator-Zugriff funktioniert

Der Teil, der bei Gruppenbuchungen tatsächlich zählt, ist nicht die Verschlüsselung allein — es ist, was passiert, wenn der Organisator wirklich deine Passdaten sehen muss, um eine Buchung abzuschließen. Genau hier scheitern die meisten „sicheren" Dokumenten-Tools leise: Entweder unterstützen sie gar kein Teilen (sodass Leute doch wieder auf Screenshots zurückgreifen), oder sie teilen dauerhaft, sobald einmal gewährt.

Der Ablauf, der das Gruppenreise-Problem tatsächlich löst, sieht so aus:

1. Jede Person fügt ihre eigenen Dokumente zu ihrem eigenen verschlüsselten Tresor hinzu — standardmäßig kann niemand sonst sie sehen.
2. Wenn eine Buchung es wirklich erfordert, gewährt diese Person dem Organisator **temporären** Zugriff — kein dauerhaftes Teilen, sondern zeitlich begrenzt.
3. Der Organisator sieht genau das, was für die Buchung nötig ist, und nicht mehr.
4. Der Zugriff kann **jederzeit widerrufen** werden — sobald die Buchung erledigt ist, wenn die Person es sich anders überlegt, oder einfach weil die Reise vorbei ist und es keinen Grund mehr gibt, dass jemand anderes es noch sieht.

Vergleiche das mit einem Chat-Screenshot: Es gibt keinen Schritt 4. Einmal verschickt, ist es dauerhaft verschickt, an alle im Chat-Verlauf, für immer.

## Eine einfache Checkliste vor deiner nächsten Gruppenreise

Diese hier solltest du speichern — zum Überfliegen und Weiterleiten an wer auch immer gerade organisiert:

- **Nie ein Foto von Pass, Ausweis oder Versicherungsnachweis direkt im Gruppenchat verschicken** — auch nicht „nur an den Organisator" per DM. DMs werden auch gesichert.
- **Fragen, ob die Buchungsplattform wirklich das ganze Dokumentenfoto braucht**, oder nur bestimmte Felder (Name, Passnummer, Ablaufdatum). Oft ist es Letzteres, und diese Felder einzutippen ist sicherer als ein Foto zu verschicken.
- **Wenn ein Dokument wirklich geteilt werden muss, ein Tool nutzen, bei dem Zugriff temporär und widerrufbar ist**, nicht eine dauerhafte Kopie.
- **Eine Erinnerung setzen, den Organisator-Zugriff nach bestätigter Buchung zu widerrufen** — nicht „für alle Fälle" offen lassen.
- **Nach der Reise prüfen, dass niemand mehr dauerhaften Zugriff** auf Dokumente hat, die nur für eine Buchung gebraucht wurden.

## Was es kostet

Das ist kein kostenpflichtiges Feature — [verschlüsselte Reisedokumente](/de/features/travel-documents/) sind Teil von Vacationists kostenloser Kern-App, genau wie Abstimmungen und Kostenteilung. Privatsphäre sollte nicht das sein, wofür man upgraden muss.

<!--CTA-->

## Häufige Fragen

### Ist es sicher, ein Foto meines Passes an eine Freundin zu schicken, die die Reise organisiert?

Nicht wirklich, selbst an jemanden, dem du voll vertraust — das Risiko ist nicht diese Person, sondern alles, wohin das Foto danach kopiert wird: Chat-Backups, Cloud-Synchronisierung und jedes andere Gerät im Chat-Verlauf, das es jetzt weiterleiten kann. Sicherer ist es, temporären, widerrufbaren Zugriff nur auf die Felder zu gewähren, die eine Buchung braucht, statt ein dauerhaftes Bild zu verschicken.

### Was passiert mit meinen Dokumenten, wenn ich eine Reise verlasse?

Bei Chat oder geteiltem Album passiert automatisch nichts — Kopien deiner Dokumente bleiben unbegrenzt auf jedem Gerät, das sie je erhalten hat. Mit Vacationists verschlüsseltem Tresor wurden deine Dokumente standardmäßig nie geteilt; jeder temporäre Zugriff, den du einem Organisator gewährt hast, kann sofort widerrufen werden, und deine Dokumente bleiben unabhängig von der Reisemitgliedschaft auf deinem eigenen Gerät verschlüsselt.

### Kann der Reiseorganisator meine Dokumente jederzeit sehen?

Nein — standardmäßig kann niemand außer dir deine Dokumente sehen. Ein Organisator sieht nur, was du ihm explizit gewährst, nur für das Zeitfenster, das du wählst, und du kannst diesen Zugriff jederzeit widerrufen. Das unterscheidet sich von einem geteilten Ordner oder Chat, wo jeder mit Zugriff alles sehen kann, dauerhaft, ohne dass du es zurücknehmen kannst.

### Ist das DSGVO-konform?

Verschlüsselung von Dokumenten im Ruhezustand mit nutzergesteuertem, widerrufbarem Zugriff ist genau die Art von Datenminimierung und Zugriffskontrolle, die die DSGVO fördern soll — du kontrollierst, was mit wem und für wie lange geteilt wird, statt dass ein Dritter standardmäßig dauerhafte Kopien deines Ausweises hält. Vacationist ist von Grund auf mit Schweizer/EU-Datenschutzstandards gebaut und gehostet, nicht nachträglich angepasst.
