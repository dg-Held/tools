# Klima am Standort – Methodik und Datenbasis

Stand: 03.08.2026

Das Klima-Tool wertet adressbezogene INCA-Rasterdaten aus und ergänzt sie um
OIB-Normklimawerte und den TIRIS-Höhenbezug. Es ist eine eigenständige
Beratungsoberfläche; derselbe Klimakern wird vom Heizlast-Tool automatisch
mitverwendet.

## Gemeinsame Daten

```text
shared/data/climate/inca/
shared/data/climate/datenstand.json
shared/data/standards/oib/
```

Die aktiven vollständigen Jahre werden aus dem INCA-Manifest gelesen. Ein neu
aufbereitetes, lückenlos ergänztes Kalenderjahr erweitert Zeitraum,
Jahreslinien, Median, Kennwerte und Exporte automatisch.

## Trennung von Oberfläche und Fachlogik

```text
shared/js/domain/climate/       Fachlogik
shared/js/tools/climate-heating-app.js  gemeinsame Steuerung
 tools/klima/index.html          ausführliche Klimaansicht
 tools/heizlast/index.html       kompakter Klimakontext für Heizlast
```

Die getrennten Tool-Seiten speichern keine eigenen Kopien der Klimadaten.

## Aussagegrenzen

- INCA ist ein 1-km-Raster und kein Messwert direkt an der Fassade.
- NAT und TNAT,13 beziehen sich auf die zugeordnete OIB-Referenz.
- Der TIRIS-Höhenvergleich weist auf mögliche lokale Abweichungen hin.
- Hitzetage und Tropennächte sind aus stündlichen Rasterwerten abgeleitete
  Orientierungskennzahlen.
