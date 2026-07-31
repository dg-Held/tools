# Freigabe Klima & Heizlast V1.1

Stand: 30.07.2026

## Zweck der Version

V1.1 ist ein Architektur-Refactoring. Die fachliche Klima- und Heizlastberechnung von V1.0 bleibt unverändert; allgemeine Projekt-, Adress- und Standortfunktionen werden in die gemeinsame Basis verschoben.

## Unveränderte fachliche Kerne

Die Dateien

- `climate-core.js`
- `heating-core.js`
- `precomputed-climate-core.js`
- `oib-nat-core.js`
- `oib-tnat13-core.js`

sind gegenüber V1.0 unverändert.

## Neu

- gemeinsame Projektkopfzeile
- gemeinsamer `localStorage`-Projektspeicher
- Übernahme eines vorhandenen Projektstandorts
- weiterhin vollständige eigenständige Standortwahl ohne Standortpass
- Adressprovider und TIRIS-DGM unter `shared/js/services/`
- BEV-Adressbestand unter `shared/data/addresses/`
- kompakte Rückgabe relevanter Eingaben/Ergebnisse an das gemeinsame Projekt

## Übergang Standortpass

Standortpass V1.5 verwendet noch die alten Klima-Pfade. Temporäre Kompatibilitätsdateien halten ihn bis zum unmittelbar folgenden Refactoring funktionsfähig. Sie enthalten keine zweite fachliche Implementierung.

## Technische Prüfungen

- JavaScript-Syntax aller JS-Dateien geprüft
- JSON-Dateien geparst
- HTML-IDs auf Duplikate geprüft
- kritische Berechnungskerne per SHA-256 gegen V1.0 verglichen: identisch
- Kompatibilitäts-Manifest gegen den gemeinsamen BEV-Datenbestand getestet

## Browserprüfung

Die endgültige Prüfung der externen Dienste (GeoSphere/TIRIS), des Drucklayouts und des gemeinsamen `localStorage` erfolgt auf der realen Website/GitHub Pages.
