# Klima am Standort – Methodik und Datenbasis

**Stand:** 04.08.2026

## 1. Zweck

Das Klima-Tool wertet adressbezogene INCA-Rasterdaten aus und ergänzt sie um OIB-Normklimawerte und den TIRIS-Höhenbezug. Es ist eine eigenständige Beratungsoberfläche. Derselbe Klimakern wird von Heizlast und für den kompakten Hüllvergleich in Energiefluss V4.2 verwendet.

## 2. Datenquellen

```text
shared/data/climate/inca/
shared/data/climate/datenstand.json
shared/data/standards/oib/
```

- GeoSphere Austria INCA, Stundenwerte im 1-km-Raster, insbesondere T2M
- OIB NAT nach Katastralgemeinde
- OIB TNAT,13 nach Katastralgemeinde
- TIRIS-Höhenbezug und Adress-/Gebäudekontext

Die aktiven vollständigen Jahre werden aus dem INCA-Manifest gelesen. Ein neues lückenlos ergänztes Kalenderjahr erweitert Zeitraum, Jahreslinien, Median, Kennwerte und Exporte automatisch.

## 3. Jahrespakete

```text
shared/data/climate/inca/
├── manifest.json
└── yearly/
    ├── index.json
    ├── 2012.json
    ├── 2012/
    └── ...
```

Pro Standort lädt der Browser nur die benötigte Kachel je Jahr. NAT-abhängige Kennwerte werden für die konkrete Katastralgemeinde beim Seitenaufruf neu gebildet.

## 4. Vollbenutzungsstunden

Die klimatischen Vollbenutzungsstunden zur Bilanztemperatur 15 °C werden aus den Stundenwerten berechnet:

```text
Vollbenutzungsstunden
= Σ max(0, (15 °C − T_a,h) / (15 °C − NAT))
```

Sie sind keine Anlagenlaufzeit. Sie beschreiben die auf die Auslegungsdifferenz normierte jährliche Temperaturbelastung und werden von Heizlast und Energiefluss als Klimakenngröße verwendet.

Daraus können Heizgradstunden zurückgerechnet werden:

```text
Heizgradstunden = Vollbenutzungsstunden × (15 °C − NAT)
```

## 5. Weitere Kennwerte

Je nach Ansicht werden unter anderem ausgewertet:

- Jahres- und Medianlinien,
- Temperaturhäufigkeit,
- Stunden unter 0, −5 und −10 °C,
- Stunden bei/unter NAT,
- Hitzetage, extreme Hitzetage und Tropennächte,
- absolute und mittlere Extremwerte,
- Dauerlinie.

## 6. Gemeinsamer Klimakontext

Das vollständige Ergebnis bleibt im jeweiligen Seitenlauf. Ein kompakter Projektkontext wird unter `modules.klima.climateSummary` gespeichert:

- Zeitraum,
- Quelle,
- NAT und TNAT,13,
- zusammengefasste Kennwerte,
- Datenstand/Aktualisierungszeit.

Heizlast und Energiefluss V4.2 können denselben Kontext selbst erzeugen; ein vorheriger Besuch der Klima-Seite ist nicht erforderlich.

## 7. Trennung von Oberfläche und Fachlogik

```text
shared/js/domain/climate/                 Fachlogik
shared/js/tools/climate-heating-app.js    Klima-/Heizlast-Steuerung
tools/klima/index.html                    ausführliche Klimaansicht
tools/heizlast/index.html                 Heizlastansicht
tools/energiefluss-v4/                    kompakter direkter Klimaaufruf
```

## 8. Aussagegrenzen

- INCA ist ein 1-km-Raster und kein Messwert direkt am Gebäude.
- NAT und TNAT,13 beziehen sich auf die zugeordnete OIB-Katastralgemeinde und deren veröffentlichte Referenzhöhe.
- Der TIRIS-Höhenvergleich zeigt mögliche lokale Abweichungen, ersetzt aber keine normgerechte Höhenkorrektur.
- Hitzetage und Tropennächte werden aus stündlichen Rasterwerten abgeleitet.
- Lokale Kaltluftseen, Hanglagen, Verschattung und kleinräumige Windverhältnisse können vom Raster abweichen.
