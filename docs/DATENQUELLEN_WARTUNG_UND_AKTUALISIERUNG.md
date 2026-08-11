# Datenquellen, Wartung und Aktualisierung

**Stand:** 11.08.2026

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

Der Exporter verwendet ausschließlich die Python-Standardbibliothek und verändert die Exceldatei nicht. Vor dem Schreiben sichert er vorhandene JSON-Dateien neben der Exceldatei unter `BAUTEIL_DATEN_BACKUPS/`. Der ausführliche letzte Prüfbericht wird neben der Exceldatei als `BAUTEIL_DATEN_EXPORTBERICHT.json` gespeichert.

Direkter Kommandozeilenaufruf, falls die BAT-Dateien nicht verwendet werden:

```text
python tools/data-build/bauteil_data_export.py --input "D:\Daten\BAUTEIL_DATEN_MASTER.xlsx" --site-root "D:\Website"
python tools/data-build/bauteil_data_export.py --input "D:\Daten\BAUTEIL_DATEN_MASTER.xlsx" --site-root "D:\Website" --write
```

### Exportierte Bereiche

- Empfehlungen und ambitionierte Ziel-U-Werte,
- Bestands-U-Werte nach Bauperiode,
- λ-Werte,
- Kosten und Sowiesokosten,
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

### Gemeinsame Gebäudedaten

`shared/data/building/existing-u-values.json` enthält transparente Bestands-U-Wert-Vorschläge nach Bauperiode. Sie sind nur Ausgangsvorschläge, wenn keine konkreten Bauteildaten bekannt sind. Priorität bleibt:

```text
manuell bestätigt → übernommen/amtlich → Bauperiodenvorschlag → Zustandsfallback
```

`shared/data/building/envelope-evaluation.json` enthält Ampelgrenzen, fachliche Empfehlungen, ambitionierte Zielwerte sowie versionierte rechtliche beziehungsweise förderbezogene Referenzwerte. Rechtliche und förderbezogene Werte sind Prüfhinweise; vor Umsetzung ist der aktuelle projektspezifische Stand zu prüfen.

## 3. INCA-Jahrespakete

Die großen INCA-Daten unter `shared/data/climate/inca/` werden gemeinsam von Klima, Heizlast sowie den direkten Klimaberechnungen in Energiefluss und Bauteil & Sanierung verwendet. Sie sind wegen ihrer Größe nicht Bestandteil jedes kleinen Austauschpakets.

Zielstruktur:

```text
shared/data/climate/inca/
├── manifest.json
└── yearly/
    ├── index.json
    ├── 2026.json
    └── 2026/
        ├── <tile>.json
        └── ...
```

Die Kachelung ist Absicht: Der Browser lädt je Standort nur die benötigte Kachel des jeweiligen Jahres.

### Neues Jahr aufbereiten

Eingabe ist ein Ordner mit den NetCDF-Dateien des Zieljahres, typischerweise zwölf Monatsdateien. Maßgeblich sind die enthaltenen Zeitstempel und die Variable `T2M`, nicht die Dateinamen.

Beispiel:

```text
INCA_JAHR_AUFBEREITEN.bat 2026 "C:\INCA\2026"
```

Beim ersten Start wird unter `tools/klima/tools/.venv_inca/` eine lokale Python-Umgebung angelegt. Dafür ist einmalig Internetzugang erforderlich, um die benötigten Pakete `numpy`, `xarray` und `netCDF4` zu installieren.

### Basiszeitraum und Aktivierung

Vor der ersten Aktivierung müssen die bisherigen Basisjahre vollständig als Jahrespakete vorliegen. Die chronologische Aufbereitung ist fachlich sinnvoll, weil jedes Paket die sechs Abendstunden des 31. Dezember für die Tropennacht-Auswertung des Folgejahres mitführt. Nur beim allerersten Basisjahr kann die Nacht zum 1. Jänner ohne Vorjahrespaket unvollständig bleiben.

Das Skript unterscheidet:

- `available_years`: bereits erzeugte Jahrespakete,
- `years`: lückenlos aktiver Zeitraum,
- `enabled`: Pakete vollständig genug für die Runtime.

Ein Jahr mit einer zeitlichen Lücke bleibt erhalten, wird aber erst aktiv, wenn die fehlenden Zwischenjahre ergänzt sind. Nach Aktivierung liest die Website den Zeitraum aus `manifest.json`; Anzeigen, Diagramme und Exportzeitraum folgen automatisch.

### Sicherheit

Das Skript überschreibt nur das ausdrücklich gewählte Jahrespaket und aktualisiert die Manifeste. Bestehende Altjahre werden nicht gelöscht. Die bisherige Runtime bleibt aktiv, bis der Basiszeitraum vollständig migriert ist.

### Strukturpaket versus Produktionsordner

Die für Entwicklung/Abgleich verwendete kompakte Struktur-ZIP kann große Adress- und INCA-Pakete absichtlich durch `etc.txt` markieren statt vollständig mitzuliefern. Das ist **nur für die Strukturprüfung** zulässig. Im veröffentlichten GitHub-Pages-/Produktionsordner müssen sämtliche Dateien vorhanden sein, die in `shared/data/addresses/manifest.json` beziehungsweise `shared/data/climate/inca/manifest.json` angekündigt werden. `tests/validate-release-integrity.js` unterscheidet diesen Strukturfall von einer echten Produktionslücke und gibt entsprechende Warnungen beziehungsweise Fehler aus.

## 4. Standards und Normen

- Normtexte sind lizenzpflichtig und werden nicht veröffentlicht.
- Rechenlogik, Quellenangaben und Abschnittsverweise dürfen dokumentiert werden.
- OIB-Prüfwerte liegen versioniert unter `shared/data/standards/oib/`. NAT- und TNAT,13-Daten werden von Klima und Heizlast gemeinsam genutzt; die `.js`-Dateien werden direkt im Browser geladen, die `.json`-Dateien bleiben als nachvollziehbare Datenrepräsentation und für Wartungszwecke erhalten.
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
```

Die vollständige Bedien- und Wartungsbeschreibung steht in diesem zentralen Dokument; eine zusätzliche lokale README ist nicht erforderlich.

Ablauf:

1. nur das neue vollständige Jahr aufbereiten,
2. Jahresindex und Manifest aktualisieren,
3. Testzelle/Adresse mit dem bisherigen Zeitraum vergleichen,
4. Klima, Heizlast und direkte Klimaberechnung in Energiefluss/Bauteiltool prüfen,
5. Datenstand im Ausdruck kontrollieren.


## DKM im Standortpass

Für die visuelle Grundstücksprüfung wird die Digitale Katastralmappe als transparente Ebene über dem Orthofoto und unter dem ausgewählten TIRIS-Gebäudepolygon geladen. Die Ebene dient ausschließlich der visuellen Plausibilisierung von Grundstücksgrenzen, Grenzbebauung und Nachbarbezug. Orthofoto und Kataster können wegen Bildsturz erhöhter Objekte sichtbar gegeneinander versetzt sein; daraus dürfen keine zentimetergenauen Grenzabstände abgeleitet werden. Die DKM wird vom BEV bezogen und in TIRIS als Basisinformation bereitgestellt; Ausfall des DKM-Dienstes darf die übrige Standortanalyse nicht verhindern.


## 9. Dokumentationsprinzip der Datenpflege

Dieses Dokument ist die verbindliche Wartungsquelle für Excel→JSON, gemeinsame Gebäudedaten, INCA-Jahrespakete und versionierte Standarddaten. Zusätzliche README-Dateien innerhalb von `shared/data/` oder `tools/` werden nicht benötigt. Bei Änderungen wird dieser zentrale Ablauf aktualisiert, damit keine widersprüchlichen lokalen Anleitungen entstehen.
