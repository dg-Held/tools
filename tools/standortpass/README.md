# Standortpass – Schnittstellentest 08

Test 08 lässt die inzwischen stabile Basis unverändert und arbeitet an zwei Punkten parallel weiter:

1. Solar-Darstellung farblich an das gemeinsame Designsystem anpassen.
2. Umweltwärme-relevante Standortinformationen aus dem öffentlichen TIRIS-WASSER-Dienst testen.

## Solar – Feinjustierung

Die Horizontdarstellung bleibt unverändert:

- Gelände / Fernverschattung: Grau
- zusätzliche Verschattung durch Gebäude / Vegetation: Türkis

Die Sonnenbahnen verwenden nun die Berry-Farbfamilie:

- Sommer: `#b3446c`
- Frühling / Herbst: `#f1dae2`
- Winter: `#6f2a43`

Da Berry Light auf hellem Hintergrund sehr hell ist, erhält die mittlere Sonnenbahn eine dezente dunklere Unterkontur. Der eigentliche Farbwert bleibt `#f1dae2`.

Die automatische Bezugshöhe bleibt:

- mit erkanntem Gebäude: TIRIS `GEB_HOEHE_MEDIAN`
- ohne geeignete Gebäudehöhe: 2 m über Gelände

Die 2-m-Ansicht bleibt bei vorhandener Gebäudegeometrie nur im Detailvergleich verfügbar.

## Wärmenetz

Der Wärmenetzkataster ist in tirisMaps unter Energie vorhanden. In den bisher geprüften öffentlichen OGD-REST-Diensten wurde jedoch kein eindeutig passender Anschlussgebiets-Layer gefunden.

Der bisherige Discovery-Test bleibt erhalten. Bis eine öffentliche Schnittstelle bestätigt ist, wird daraus keine automatische fachliche Aussage zur Fernwärmeverfügbarkeit erzeugt.

## Umweltwärme – neuer Test

Quelle:

`Service_Public/ogd_wasser/MapServer`

Der Test liest die Servicebeschreibung live und sucht dynamisch nach passenden Feature-Layern, insbesondere:

- Erdwärmesonden
- Grundwasserentnahmen
- Grundwasserrückgaben
- Grundwassersonden
- Grundwasser-Messstellen
- Schutz- und Schongebiete

Danach werden nur kleine standortbezogene Abfragen durchgeführt:

- Punkt-/Anlageninformationen: 500 m Testumkreis
- Schutz-/Schongebiete: direkter Punkt-in-Polygon-Test am Standort

Wichtig: Diese Ergebnisse sind **keine Eignungsbewertung** für Erdsonden- oder Grundwasser-Wärmepumpen. Vorhandene Anlagen oder Nutzungen im Umfeld beweisen keine technische oder rechtliche Eignung des eigenen Grundstücks.

## Installation

Die vier Dateien in `tools/standortpass/` ersetzen:

- `index.html`
- `schnittstellentest.css`
- `schnittstellentest.js`
- `README.md`

`tools/klima-heizlast/` bleibt unverändert.

## Sinnvolle Testadresse

Bürgerstraße 1, 6020 Innsbruck ist weiterhin gut geeignet, weil dort Adresse, KG, Gebäude, Orthofoto, DGM, Solar und die Wärmenetz-Situation bereits bekannt bzw. kontrollierbar sind.

Für Umweltwärme ist zusätzlich eine Adresse außerhalb dichter Innenstadtlage interessant, um zu sehen, welche Sonden-, Grundwasser- und Schutzgebietsdaten TIRIS im Umfeld liefert.
