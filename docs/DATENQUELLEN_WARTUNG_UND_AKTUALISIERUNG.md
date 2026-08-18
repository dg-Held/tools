# Datenquellen, Wartung und Aktualisierung

**Stand:** 18.08.2026

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
- Kosten und Referenz-Erneuerungskosten,
- Energiepreise,
- Emissionsfaktoren,
- qualitative Komfort-/Ökologiehinweise.

## 2. Master-Excel und Datenexport

Die Master-Excel ist die menschlich wartbare Quelle für veränderliche Beratungsdaten. Sie wird **außerhalb des veröffentlichten Website-Ordners** abgelegt. Normative OIB-Prüfwerte und Nutzungsdauern bleiben getrennte Standarddateien; Förderungen bleiben projektbezogene Eingaben.

Empfohlene lokale Struktur:

```text
Energieberatung-Arbeitsordner/
├── BAUTEIL_DATEN_MASTER.xlsx
└── Website/
    ├── shared/
    ├── tools/
    └── pages/
```

GitHub Pages veröffentlicht Dateien des verwendeten Repository-Branches. Eine Exceldatei mit internen Quellen, Kommentaren oder noch nicht freigegebenen Kennwerten gehört deshalb nicht in diesen Ordner.

### Pflegeablauf

1. Quelle und Datenstand dokumentieren.
2. Rohwert ungerundet eintragen.
3. Datensatz fachlich prüfen und erst dann `Aktiv = ja` setzen.
4. `tools/data-build/BAUTEIL_DATEN_PRUEFEN.bat` ausführen.
5. Warnungen und Datensatzanzahl prüfen.
6. `BAUTEIL_DATEN_AUFBEREITEN.bat` ausführen.
7. Website lokal testen.
8. Nur die geänderten JSON-Dateien und das Manifest zu GitHub hochladen.

### Technischer Ablauf

```text
BAUTEIL_DATEN_MASTER.xlsx
    ↓ bauteil_data_export.py
shared/data/.../*.json
shared/data/bauteil-data-manifest.json
```

Der Exporter verwendet ausschließlich die Python-Standardbibliothek und verändert die Exceldatei nicht. Vor dem Schreiben sichert er vorhandene JSON-Dateien neben der Exceldatei unter `BAUTEIL_DATEN_BACKUPS/`.

### Exportierte Bereiche

- Empfehlungen und ambitionierte Ziel-U-Werte,
- Bestands-U-Werte nach Bauperiode,
- λ-Werte,
- Kosten und Referenz-Erneuerungskosten,
- Energiepreise,
- Emissionsfaktoren,
- Finanzannahmen und Rundung,
- Komfort-/Ökologiehinweise.

Nicht aus der Exceldatei exportiert werden:

- OIB-Prüfwerte,
- Nutzungsdauern,
- Fenster-/Tür-Austauschvarianten,
- Förderprogramme oder automatische Fördersätze.

### Sicherer Standardmodus

- Pflichtbereiche müssen mindestens einen aktiven Datensatz enthalten.
- Leere Kosten-, Energiepreis- oder Emissionsbereiche behalten vorhandene Website-Dateien bei.
- Fehlende Finanzstandardwerte behalten die vorhandene Website-Datei bei.
- Befüllte, aber nicht aktivierte Zeilen erzeugen eine Warnung.
- Das Manifest enthält Excel-Dateiname, SHA-256-Prüfsumme, Modellversion, Exportzeit und Warnungen.

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

### Strukturpaket versus Produktionsordner

Die für Entwicklung/Abgleich verwendete kompakte Struktur-ZIP kann große Adress- und INCA-Pakete absichtlich durch `etc.txt` markieren statt vollständig mitzuliefern. Das ist **nur für die Strukturprüfung** zulässig. Im veröffentlichten GitHub-Pages-/Produktionsordner müssen sämtliche Dateien vorhanden sein, die in `shared/data/addresses/manifest.json` beziehungsweise `shared/data/climate/inca/manifest.json` angekündigt werden. `tests/validate-release-integrity.js` unterscheidet diesen Strukturfall von einer echten Produktionslücke und gibt entsprechende Warnungen beziehungsweise Fehler aus.

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
shared/data/measures/measure-effects.json
shared/data/costs/renovation-costs.json
shared/data/standards/economics/component-lifetimes.json
shared/data/standards/oib/envelope-u-values.json
shared/data/economics/financial-defaults.json
shared/data/economics/energy-prices.json
shared/data/emissions/emission-factors.json
shared/data/building/existing-u-values.json
```

`measure-effects.json` ist die **einzige zentrale Quelle für qualitative Zusatzwirkungen**. Sie enthält zwei getrennte Namensräume: `components` für bauteilspezifische Detailtexte (z. B. Winterkomfort/Feuchte) und `items` für qualitative Wirkungsprofile der Sanierungsfahrplan-Karten. Die Excel→JSON-Pipeline aktualisiert nur `components` und bewahrt `items`; dadurch entstehen keine parallelen Wirkungsdatensätze. Die Angaben verändern weder technische noch wirtschaftliche Berechnungen und werden nicht zu einem Kundenscore summiert.

Für den Sanierungsfahrplan sind außerdem `shared/data/roadmap/cards.json` und `shared/data/roadmap/relations.json` zentrale Quellen. Karten-IDs sind stabil zu halten, weil `roadmap.items.*.cardId` darauf verweist. Relationen verwenden ausschließlich die dokumentierten Typen `before / together / prepare / check / avoid_lock_in / suggest`; neue Beziehungen benötigen Regressionstest und dokumentierte Beratungsbotschaft. Quantitative Energie- und Kostenwerte werden **nicht** in diesen Fahrplandateien dupliziert.

Prüfungen nach Datenupdate:

1. JSON-Syntax und eindeutige IDs.
2. Zielwerte logisch ordnen.
3. Kostenstufen niedrig ≤ mittel ≤ hoch.
4. Referenz-Erneuerungskosten ≤ Vollkosten.
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


## DKM im Standortpass

Für die visuelle Grundstücksprüfung wird die Digitale Katastralmappe als transparente Ebene über dem Orthofoto und unter dem ausgewählten TIRIS-Gebäudepolygon geladen. Die Ebene dient ausschließlich der visuellen Plausibilisierung von Grundstücksgrenzen, Grenzbebauung und Nachbarbezug. Orthofoto und Kataster können wegen Bildsturz erhöhter Objekte sichtbar gegeneinander versetzt sein; daraus dürfen keine zentimetergenauen Grenzabstände abgeleitet werden. Die DKM wird vom BEV bezogen und in TIRIS als Basisinformation bereitgestellt; Ausfall des DKM-Dienstes darf die übrige Standortanalyse nicht verhindern.


## Kosten-/Referenzdaten · Prüfrunde 13.08.2026

- BKI bleibt interne lizenzierte Plausibilisierungsquelle; veröffentlichte Runtime-Daten sind EAT-Beratungswerte.
- Für die interne Tirol-Plausibilisierung ist der bereitgestellte **Regionalfaktor Tirol 1,019** dokumentiert. Er wird nicht noch einmal auf bereits festgelegte EAT-Richtwerte multipliziert.
- Referenz-Erneuerungskosten und typische Nutzungsdauern werden getrennt versioniert und vor V1.0 fachlich geprüft. Konkrete Angebote, Zustand und bekannte Erneuerungstermine haben Vorrang.
