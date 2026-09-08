---
title: Reiseplaner, der ohne Signal funktioniert | Vacationist
description: Vacationist funktioniert eine Woche ohne Verbindung — Reisepläne offline lesen, Ausgaben erfassen und abstimmen; alles gleicht sich ab, sobald du online bist.
path: /de/features/offline/
lang: de
type: feature
schema: WebPage
date: 2026-09-08
altPath: /features/offline/
keywords: Offline Reiseplaner, Reise-App offline nutzbar, Gruppenreise App ohne Internet, Ausgaben teilen ohne Internet, Reiseplaner ohne Empfang
related: /de/features/travel-documents/, /de/features/expenses/, /de/features/voting/, /de/features/transfers/
breadcrumbLabel: Offline-Modus
---

# Der Reiseplaner, der kein Signal braucht

<p class="lede">Genau dann, wenn du deinen Reiseplan wirklich brauchst, hast du meistens keinen Empfang: im Flugzeug beim Boarding, auf der Fähre zwischen zwei Inseln, in einem Tal ohne Netz, mit einer ausländischen SIM, die noch nicht freigeschaltet ist. Die meisten Reise-Apps zeigen dann einen Ladekreis oder eine leere Seite. Vacationist läuft weiter — eine ganze Woche lang ohne Verbindung — und gleicht im Hintergrund alles ab, sobald du wieder online bist.</p>

## Was ohne Verbindung weiterhin geht

Alles, was du schon einmal geöffnet hast, liegt auf deinem Handy und nicht nur auf einem Server:

- **Den ganzen Plan lesen** — Reiseverlauf, Aktivitäten, Unterkünfte, Flüge und Transfers, Einkaufs- und Packlisten, Ausgaben und Salden, den Reisekalender. Was du online einmal angesehen hast, ist auch offline da.
- **Weiterplanen** — eine Ausgabe eintragen, einen Punkt auf der Packliste abhaken, abstimmen, eine Aktivität ergänzen, eine Notiz ändern. Deine Änderungen erscheinen sofort und landen in einer Warteschlange.
- **Angemeldet bleiben** — Vacationist wirft dich nie zurück auf den Anmeldebildschirm, solange eine gültige Reise auf deinem Handy liegt. (Das alte Ärgernis — die Reise-App meldet dich im Flugzeug ab, und danach kommst du nicht wieder rein, weil die Anmeldeseite nicht lädt — kann hier nicht passieren.)

Sobald dein Handy wieder Empfang hat, gehen deine Änderungen nacheinander automatisch raus, die Ansichten aktualisieren sich, und die Echtzeit-Verbindung zur Gruppe stellt sich von selbst wieder her. Du musst nichts auf „Synchronisieren" tippen.

## Auf eine Woche ausgelegt, nicht auf ein paar Minuten

Vacationist ist von Anfang an offline-first, und eine Überarbeitung 2026 hat das Offline-Fenster deutlich verlängert:

- **Reisedaten bleiben 30 Tage lang gespeichert** — genug für eine zweiwöchige Reise mit einem Funkloch mittendrin.
- **Du bleibst 7 Tage offline angemeldet**, ganz ohne Serverkontakt. Erst danach fragt Vacationist nach Fingerabdruck oder Geräte-PIN, um die Anmeldung zu verlängern — ein kurzes Entsperren, nie ein erneutes Anmelden, das du ohne Internet gar nicht abschließen könntest.
- **Änderungen in der Warteschlange überstehen einen Neustart der App** und ein Abschalten bei leerem Akku. Sie liegen getrennt von allem anderen, damit ein Aufräumen des Caches sie nicht mitnimmt.
- **Die aktive Reise wird vorgeladen.** Öffnest du eine Reise, holt die App ihre Tabs und Bilder im Hintergrund aufs Gerät — sie sind da, selbst wenn du offline gehst, bevor du sie überhaupt angetippt hast.

## Das Eine, das bewusst online bleibt

[Verschlüsselte Reisedokumente](/de/features/travel-documents/) — Reisepass- und Ausweisdaten — werden **nicht** auf dem Gerät zwischengespeichert. Sie werden nur entschlüsselt, während du online bist und den Tresor entsperrst, und nie auf dem Gerät abgelegt. Das ist eine bewusste Abwägung: Deine sensibelsten Daten liegen nicht auf einem Handy, das verloren gehen kann. Alles Übrige zur Reise ist offline verfügbar.

<!--CTA-->

## Häufige Fragen

### Wie lange funktioniert Vacationist offline?

Mindestens eine Woche. Reisedaten bleiben 30 Tage gespeichert, und du bleibst 7 Tage ohne Serverkontakt angemeldet — danach verlängert ein Fingerabdruck oder die Geräte-PIN die Anmeldung, komplett ohne Internet. In der Praxis müsstest du für eine sehr lange Reise ohne Netz sein, um überhaupt an eine Grenze zu kommen.

### Können meine Offline-Änderungen verloren gehen?

Nein. Was du offline änderst, landet in einer Warteschlange, die getrennt vom App-Cache gespeichert ist und ein Schließen oder Beenden der App übersteht. Sobald du wieder online bist, gehen die Änderungen in der Reihenfolge raus, in der du sie gemacht hast. Lässt sich eine davon auf dem Server nicht anwenden — etwa weil jemand die Aktivität gelöscht hat, über die du abgestimmt hast —, bekommst du eine klare Meldung, und es schlägt nicht einfach unbemerkt fehl.

### Sehen andere meine Änderungen, während ich offline bin?

Erst wenn du wieder online bist — vorher gibt es keine Verbindung, über die sie gehen könnten. Sobald du zurück bist, synchronisieren sich deine Änderungen auf die Geräte der anderen, und ihre auf deins. Haben zwei Leute unabhängig voneinander dasselbe bearbeitet, gewinnt die jüngste Änderung, und du siehst das Ergebnis beim Synchronisieren.

### Funktioniert die Web-Version auch offline?

Die Offline-Funktionen sind für die mobilen Apps (iOS und Android) gemacht, wo die Reisedaten auf dem Gerät liegen. Die Web-App unter web.vacationist.app braucht eine Verbindung — sie ist am besten, wenn jemand vom Laptop aus einer Reise beitritt, nicht für unterwegs.

### Warum sind Reisedokumente nicht offline verfügbar?

Reisepass- und Ausweisfelder werden verschlüsselt gespeichert und nur im Arbeitsspeicher entschlüsselt — hinter der biometrischen Sperre deines Geräts und nur, während du online bist. Sie gar nicht erst aufs Gerät zu legen heißt: Ein verlorenes oder gestohlenes Handy hat sie schlicht nicht. Jeder andere Teil der Reise ist zwischengespeichert und funktioniert offline.
