# Klima & Heizlast · gemeinsame Datenbasis

Stand: 30.07.2026

## Ziel

Die fachliche Klima- und Heizlastberechnung bleibt im Tool. Wiederverwendbare Projekt- und Standortfunktionen liegen außerhalb des Toolordners und können später auch von Standortpass, Energiefluss und Wirtschaftlichkeit verwendet werden.

## Getrennte Ebenen

### Gemeinsame Projektbasis

`shared/js/data-model.js`, `project-store.js`, `project-header.js`

Speichert kleine projektbezogene Fakten im Browser (`localStorage`). Große Klima-Rohdaten werden nicht im Projekt gespeichert.

### Gemeinsame Standortservices

`shared/js/services/`

- Adressprovider-Grundlogik
- lokaler BEV-Adressprovider
- TIRIS-DGM-Höhenservice

Der lokale BEV-Bestand liegt unter `shared/data/addresses/` und ist dadurch nicht mehr Bestandteil des Klima-Tools selbst.

### Klima-&-Heizlast-spezifisch

Im Toolordner verbleiben INCA, OIB NAT/TNAT,13 und alle fachlichen Berechnungen.

## Priorität bei der Standortwahl

1. Ein vorhandenes gemeinsames Projekt kann die Adresse/Koordinate/KG vorbefüllen.
2. Ohne Projekt kann die Adresse weiterhin eigenständig gesucht werden.
3. Manuelle Koordinaten/NAT bleiben als Rückfallebene erhalten.

Das Vorhandensein des Standortpasses ist keine Voraussetzung.

## Gemeinsame Werte

Klima & Heizlast kann u. a. folgende Werte übernehmen bzw. zurückschreiben:

- Projekttitel / Projekt-ID
- Adresse
- Koordinaten
- Gemeinde / GKZ
- KGNR
- Geländehöhe
- Personen
- beheizte Nutzfläche

Tool-spezifische Annahmen und Ergebnisse bleiben zusätzlich unter `modules.klimaHeizlast` gespeichert.
