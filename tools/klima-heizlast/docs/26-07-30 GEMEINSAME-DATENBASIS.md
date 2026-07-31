# Klima & Heizlast · gemeinsame Datenbasis

Stand: 31.07.2026 · Version 1.2

## Ziel

Die fachliche Klima- und Heizlastberechnung bleibt im Tool. Wiederverwendbare Projekt- und Standortfunktionen liegen außerhalb des Toolordners und können später auch von Standortpass, Energiefluss und Wirtschaftlichkeit verwendet werden.

## Getrennte Ebenen

### Gemeinsame Projektbasis

`shared/js/data-model.js`, `project-store.js`, `project-header.js`

Speichert kleine projektbezogene Fakten im Browser (`localStorage`). Große Klima-Rohdaten werden nicht im Projekt gespeichert.

### Gemeinsame Standortservices

`shared/js/services/`

- Adressprovider-Grundlogik
- lokaler BEV-Adressprovider für schnelle Vorschläge und Offline-/Ausfall-Fallback
- TIRIS-Live-Adressprovider (`ogd_basis`, bevorzugt ADRCD)
- Hybrid-Adressprovider: BEV-Autocomplete → TIRIS-Liveauflösung nach Auswahl
- TIRIS-DGM-Höhenservice

Der lokale BEV-Bestand liegt unter `shared/data/addresses/` und ist dadurch nicht mehr Bestandteil des Klima-Tools selbst.

### Klima-&-Heizlast-spezifisch

Im Toolordner verbleiben INCA, OIB NAT/TNAT,13 und alle fachlichen Berechnungen.

## Priorität bei der Standortwahl

1. Ein vorhandenes gemeinsames Projekt kann Adresse/Koordinate/KG vorbefüllen.
2. Ohne Projekt kann die Adresse weiterhin eigenständig gesucht werden.
3. Während der Eingabe liefert BEV lokale Vorschläge; nach Auswahl wird bevorzugt live in TIRIS aufgelöst.
4. Bei fehlendem Live-Treffer oder Ausfall bleibt die BEV-Adresse als gekennzeichneter Fallback nutzbar.
5. Manuelle Koordinaten/NAT bleiben als letzte Rückfallebene erhalten.

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

## Übergangsbrücken

Bis der Standortpass ebenfalls auf `shared/js/services/` umgestellt ist, bleiben im Klima-Tool kleine Kompatibilitätsdateien für die bisherigen Pfade bestehen. Sie enthalten keine zweite Fachlogik. Nach der Standortpass-Umstellung werden diese Brücken und nicht mehr benötigte Altpfade bewusst entfernt.

## INCA

Die INCA-Vorberechnung bleibt tool-spezifisch, weil sie fachliche Klimaauswertungen enthält. Neu ist jedoch die wartungsfreundliche jahresweise Paketierung. Große Stunden-/Rasterdaten werden weiterhin **nicht** in `localStorage` oder in das gemeinsame Projekt geschrieben.
