# Roadmap

**Stand:** 07.08.2026

## Unmittelbar

1. Drei reale Beratungsfälle vollständig von Standortpass bis Bauteil & Sanierung durchspielen.
2. Dabei insbesondere automatische TIRIS-Geometrie, NFL/BGF-Korrekturen, thermische Hülle, Klima-/HGT-Grundlage und Ausdruck fachlich gegen bekannte Projektwerte halten.
3. Auffälligkeiten als gezielte V1.x-Korrekturen dokumentieren und nur fachlich bestätigte Änderungen übernehmen.
4. Danach Master-Excel fachlich vervollständigen und die Excel→JSON-Datenpipeline gegen den vollständigen lokalen Datenbestand testen.

## Danach

### Datenvalidierung und erste stabile Freigabe

- Quellen und Datenstände vollständig,
- Kostenmodelle und Sowiesokosten plausibilisiert,
- Energiepreise und Emissionsfaktoren freigegeben,
- Ausdruck und Projektmaßnahme geprüft,
- Datenmanifest im Release dokumentiert.

### Allgemeines Wirtschaftlichkeitstool

Vergleicht gespeicherte Maßnahmen und Pakete:

- Außenwand,
- Fenster,
- Haustür,
- Dach/OGD,
- Kellerdecke/Boden,
- später Heizung, Verteilung und Lüftung.

Stufen:

- Schnellabschätzung,
- verbrauchsbasiert,
- energieausweisbasiert.

### Sanierungsfahrplan

- Maßnahmenkacheln,
- jetzt / kurzfristig / mittelfristig / später,
- Abhängigkeiten und Reihenfolgehinweise,
- Kommentare,
- kompakter Beratungsbericht.

## Später mögliche Werkzeuge

- Heizung & Verteilung,
- Lüftung und Raumluft,
- Sommerkomfort-Risikocheck,
- Speichergröße und Eigenverbrauch,
- Schnellrechner/Fachlinks,
- zusammengeführter Beratungsbericht.

Leitfrage bei jedem neuen Werkzeug:

> Bringt es in einer realen Energieberatung einen eigenen klaren Mehrwert, oder gehört es als Funktion in ein bestehendes Tool?

## Abgeschlossen bis 07.08.2026

- Klima V1.0, Heizlast V1.0, Standortpass V1.1 und Energiefluss V4.4 vereinheitlicht und dokumentiert.
- Bauteil & Sanierung V1.0 mit thermischem Hüllstatus und automatischen Maßnahmenpaketen abgeschlossen.
- Tooltips auf das Info-Symbol begrenzt.
- Geometriekette V1.4 mit festen Erstannahmen 3,2 m / 0,75, beheiztem Anteil, Fensterregler und nachgeführten Hüllflächen umgesetzt; Dachfläche bleibt TIRIS-basiert.
- Methodenbereiche um die tatsächlich verwendeten Formeln ergänzt.
- Favicon zentral eingebunden und technischer Release-Check ergänzt.
- Temperatur-Heatmap und Windrose bleiben bewusst für eine spätere Erweiterungsrunde zurückgestellt.
