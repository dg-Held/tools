# Datenquellen, Wartung und Aktualisierung

**Stand:** 05.08.2026

## 1. Quellenklassen

### Amtlich/extern

- TIRIS: Adresse, Gebäude, Höhen, Karten- und Risikodaten.
- BEV: lokale Adressvorschläge/Fallback.
- GeoSphere/INCA: Klimazeitreihen und vorberechnete Jahrespakete.
- OIB: NAT/TNAT und versionierte Prüfdaten.
- weitere Fachstellen: Radon, BDA, Wasserinformationen.

### Intern gepflegt

- Bestands-U-Werte nach Bauperiode,
- Beratungsempfehlungen und ambitionierte Ziele,
- Kosten und Sowiesokosten,
- Energiepreise,
- Emissionsfaktoren,
- qualitative Komfort-/Ökologiehinweise.

## 2. Master-Excel

Die Master-Excel ist die menschlich wartbare Quelle für veränderliche Beratungsdaten. Normative OIB-Prüfwerte und Nutzungsdauern bleiben getrennte Standarddateien.

Pflegeablauf:

1. Quelle und Datenstand dokumentieren.
2. Rohwert ungerundet eintragen.
3. Status prüfen/freigeben.
4. automatische Plausibilitäts- und Rundungstests durchführen.
5. JSON kontrolliert erzeugen.
6. Website und Ausdruck testen.

Geplanter Export:

```text
BAUTEIL_DATEN_MASTER.xlsx
    ↓ Aufbereitungsskript
shared/data/.../*.json
```

## 3. INCA-Jahrespakete

Zielpfad:

```text
shared/data/climate/inca/
├── manifest.json
└── yearly/
    ├── index.json
    ├── 2012/
    └── ...
```

Ein neues vollständiges Jahr wird einmal mit dem vorhandenen Python-/BAT-Ablauf erzeugt und ergänzt. Große Datenordner werden nicht in kleinen Codepaketen mitgeliefert.

## 4. Standards und Normen

- Normtexte sind lizenzpflichtig und werden nicht veröffentlicht.
- Rechenlogik, Quellenangaben und Abschnittsverweise dürfen dokumentiert werden.
- OIB-Prüfwerte liegen versioniert unter `shared/data/standards/oib/`.
- Nutzungsdauern liegen versioniert unter `shared/data/standards/economics/component-lifetimes.json`.
- Projektspezifische Abweichungen müssen überschreibbar und dokumentierbar bleiben.

## 5. Förderungen

Keine automatisch gepflegte Fördertabelle im Tool. Berater trägt ein:

- Landesförderung,
- Bundesförderung,
- sonstige Förderung,

jeweils als Prozentsatz oder Fixbetrag. Quelle/Notiz projektbezogen dokumentieren.

## 6. Aktualisierungscheck

Bei Datenupdate prüfen:

- Datenstand und Quellenregister,
- ID-Stabilität,
- Einheiten,
- Rundung nur in Anzeige, nicht im Rechenkern,
- Rückwärtskompatibilität gespeicherter Projekte,
- Rechentests,
- Druck und JSON-Export.

## 7. Zentrale Datendateien Bauteil & Sanierung

```text
shared/data/measures/envelope-targets.json
shared/data/measures/exchange-variants.json
shared/data/measures/lambda-values.json
shared/data/measures/co-benefits.json
shared/data/costs/renovation-costs.json
shared/data/standards/economics/component-lifetimes.json
shared/data/standards/oib/envelope-u-values.json
shared/data/economics/financial-defaults.json
shared/data/economics/energy-prices.json
shared/data/emissions/emission-factors.json
shared/data/building/existing-u-values.json
```

Prüfungen nach Datenupdate:

1. JSON-Syntax und eindeutige IDs.
2. Zielwerte logisch ordnen.
3. Kostenstufen niedrig ≤ mittel ≤ hoch.
4. Sowiesokosten ≤ Vollkosten.
5. Einheiten und Preisbasis prüfen.
6. Quellen, Status und Datenstand aktualisieren.
7. Regressions- und Drucktest.

## 8. INCA-Aufbereitung

Hilfsdateien:

```text
tools/klima/tools/INCA_JAHR_AUFBEREITEN.bat
tools/klima/tools/inca_year_precompute.py
tools/klima/tools/README-INCA-JAHRESPAKETE.md
```

Ablauf:

1. nur das neue vollständige Jahr aufbereiten,
2. Jahresindex und Manifest aktualisieren,
3. Testzelle/Adresse mit dem bisherigen Zeitraum vergleichen,
4. Klima, Heizlast und direkte Klimaberechnung in Energiefluss/Bauteiltool prüfen,
5. Datenstand im Ausdruck kontrollieren.
