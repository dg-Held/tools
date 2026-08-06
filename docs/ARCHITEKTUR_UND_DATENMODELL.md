# Architektur und Datenmodell

**Stand:** 06.08.2026

## 1. Schichten

```text
Tool-Oberflächen
    ↓
gemeinsame UI-Komponenten und Projektkopf
    ↓
Fachkerne und Services
    ↓
gemeinsames Projektmodell
    ↓
versionierte Datendateien / externe amtliche Dienste
```

Oberflächen dürfen gemeinsame Dienste aufrufen, besitzen aber keine eigene Kopie derselben Fachlogik.

## 2. Hauptstruktur

```text
shared/
├── css/
├── data/
├── js/
│   ├── data-model.js
│   ├── project-migrations.js
│   ├── value-resolver.js
│   ├── project-store.js
│   ├── project-header.js
│   ├── services/
│   └── domain/
tools/
├── data-build/
├── standortpass/
├── klima/
├── heizlast/
├── energiefluss-v4/
└── bauteil-sanierung/
docs/
tests/
```

## 3. Projektfeld

Ein fachlicher Wert ist kein nackter Zahlenwert, sondern enthält Kandidaten:

```text
manual
official
derived
fallback
```

Der Resolver wählt nach der Priorität:

```text
manual > official > derived > fallback
```

Zusatzinformationen:

- Einheit,
- Quelle/URL,
- Datenstand,
- Methode und Modellversion,
- Qualität/Unsicherheit,
- Notiz und Aktualisierungszeit.

## 4. Geometriepfade

```text
building.geometry.footprintArea
building.geometry.perimeter
building.geometry.heightMedian
building.geometry.heightMaximum
building.geometry.storeysAboveGround
building.geometry.grossFloorArea
building.geometry.usableFloorArea
building.geometry.heatedFloorArea
building.geometry.grossVolume
building.geometry.reference.*
building.thermal.heatedSharePercent
building.thermal.heatedVolume
```

`building.geometry.reference.*` speichert die reine automatische Referenz ohne manuelle Korrekturen. Die Hauptfelder speichern die verwendete Kette mit manuellen Prioritäten.

## 5. Gemeinsame Begriffe und Energiepfade

Gleiche fachliche Werte werden in allen Tools gleich bezeichnet und nur einmal im Projektmodell gespeichert:

```text
Heizenergieverbrauch (kWh/a)       → consumption.heating.annualEnergy
Nutzwärmefaktor (JNG / JAZ)        → systems.heating.usefulHeatFactor
Warmwasser enthalten               → systems.heating.hotWaterIncluded
Personen                            → usage.household.persons
Beheizte Nutzfläche                 → building.geometry.heatedFloorArea
Gebäudezustand                      → building.thermal.condition
```

Der Begriff **Nutzwärmefaktor** ist der gemeinsame Oberbegriff: Bei Kesseln entspricht er dem Jahresnutzungsgrad, bei Wärmepumpen der Jahresarbeitszahl. Werte über 1,0 sind daher zulässig. Energiefluss stellt in diesem Fall die Differenz zwischen Nutzwärme und bezogener Heizenergie als Umweltwärme dar, damit die Bilanz geschlossen und fachlich verständlich bleibt.

Oberflächen dürfen Synonyme nicht als neue Speicherfelder anlegen. Ein manueller Wert hat gemäß Resolver-Priorität Vorrang; automatische Vorschläge bleiben als Herkunftskandidat erhalten.

## 6. Geometrieabhängigkeiten

### Referenz

```text
storeys_ref = round(heightMedian / storeyHeightModule)
bgf_ref = footprintArea × storeys_ref
nfl_ref = bgf_ref × usableFloorAreaFactor
heatedFloorArea_ref = nfl_ref
grossVolume_ref = footprintArea × heightMedian
```

### Verwendet

```text
storeys = manual oder storeys_ref
bgf_derived = footprintArea × storeys
bgf = manual oder bgf_derived
nfl_derived = bgf × usableFloorAreaFactor
nfl = manual oder nfl_derived
heatedFloorArea_derived = nfl
heatedFloorArea = manual oder derived, jedoch höchstens nfl
```

### Volumen

```text
grossVolume = footprintArea × heightMedian
heatedSharePercent = heatedFloorArea / nfl
heatedVolume = grossVolume × heatedSharePercent
```

Das Bruttovolumen reagiert daher nicht auf eine Änderung der Geschoßzahl oder BGF. Diese Größen beschreiben die innere Flächenorganisation, nicht die äußere Gebäudehülle.

## 7. Maßnahmenmodell

Eine Maßnahme enthält mindestens:

- ID und Kategorie,
- betroffenes Bauteil/System,
- Bestand und Zielvariante,
- technische Wirkung,
- Energie-/CO₂-Wirkung,
- Kosten, Sowiesokosten und Förderung,
- Wirtschaftlichkeit,
- Komfortwirkung,
- Quellen- und Modellversionen,
- Kommentar und Zeitstempel.

Energiefluss, Wirtschaftlichkeit und Sanierungsfahrplan verwenden dieselbe Maßnahme.

## 8. Ergebnisse und Cache

Eingaben und bestätigte Entscheidungen werden gespeichert. Rechenergebnisse werden bei Bedarf neu hergeleitet. Ein Cache darf nur verwendet werden, wenn Eingabefingerprint, Modellversion und Datenstand passen.

## 9. Datenpipeline und Quellen der Wahrheit

```text
private Arbeitsdatei (XLSX)
        ↓ lokaler Export
versionierte JSON-Dateien im Website-Repository
        ↓ fetch()
Tool-Oberflächen und Fachkerne
```

Die Exceldatei ist die menschlich wartbare Quelle für veränderliche Beratungsdaten, aber kein Laufzeitbestandteil der Website. Zur Laufzeit werden ausschließlich JSON-Dateien gelesen.

Getrennte Quellen der Wahrheit:

- OIB-Prüfdaten: `shared/data/standards/oib/`,
- Nutzungsdauern: `shared/data/standards/economics/component-lifetimes.json`,
- Austauschvarianten: `shared/data/measures/exchange-variants.json`,
- pflegbare Beratungsdaten: externe Excel → erzeugte JSON-Dateien,
- Förderungen: Projektangaben im gemeinsamen Projektspeicher.

Der Export erfolgt atomar. Optionale leere Datensätze dürfen vorhandene freigegebene JSON-Dateien im sicheren Standardmodus nicht ersetzen.
