# Installation – Stabilisierungspaket 1.1

## Voraussetzung

Dieses Paket baut direkt auf dem bereits installierten Grundumbau Pakete 1–4 auf. Es berücksichtigt den Stand, den du vollständig übernommen und getestet hast.

## Schritt 1 – Sicherheitskopie

Die vorhandene Sicherheitskopie beibehalten. Zusätzlich kann vor dem Kopieren ein aktuelles Projekt als JSON exportiert werden.

## Schritt 2 – Dateien kopieren

Den Inhalt des Ordners `Energieberatung_Stabilisierung_Paket_1-1_2026-08-03` über den Website-Hauptordner kopieren.

Gleichnamige Dateien ersetzen lassen.

Der äußere Paketordner darf nicht als zusätzlicher Unterordner in der Website landen.

## Schritt 3 – Keine großen Daten bewegen

Diese Ordner bleiben unverändert:

- `shared/data/climate/inca/`
- `shared/data/addresses/`
- `shared/data/standards/oib/`

Es sind keine Dateien zu verschieben oder zu löschen.

## Schritt 4 – Browsercache leeren

Nach dem Kopieren Klima, Heizlast und Standortpass mit `Strg + F5` neu laden. Die HTML-Dateien verwenden neue Versionsparameter für die geänderten CSS- und JavaScript-Dateien.

## Schritt 5 – Testen

Den Ablauf in `TESTPLAN-PAKET-1-1.md` durchführen. Erst danach auf GitHub Pages hochladen.
