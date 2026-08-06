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

Die gemeinsame Ableitung läuft unter `building-geometry-v1.3`. Sie hält eine unveränderte automatische Referenz und eine verwendete Kette mit manuellen Prioritäten parallel vor.

### Feste Erstannahmen

```text
storeyHeightModule = 3,2 m
usableFloorAreaFactor = 0,75
defaultWindowShare = 25 %
```

Diese Werte sind Beratungsannahmen, keine allgemein gültigen Normwerte. Sie werden zentral hinterlegt und nicht als manuelle Projektwerte gespeichert.

### Automatische Referenz

```text
storeys_ref = round(heightMedian / 3,2 m)
bgf_ref = footprintArea × storeys_ref
nfl_ref = bgf_ref × 0,75
heatedFloorArea_ref = nfl_ref
grossVolume_ref = footprintArea × heightMedian
```

Die Referenzfelder unter `building.geometry.reference.*` reagieren nicht auf spätere Benutzereingaben.

### Verwendete Flächenkette

```text
storeys = manuell oder storeys_ref

bgf =
  manuelle BGF, sonst
  manuelle NFL / 0,75, sonst
  footprintArea × storeys

nfl = manuelle NFL oder bgf × 0,75
effectiveFootprint = bgf / storeys
```

Wenn BGF und NFL beide manuell bekannt sind, bleiben beide erhalten; eine Abweichung vom 0,75-Faktor ist als Prüfhilfe zu kennzeichnen, nicht automatisch zu überschreiben.

### Beheizter Anteil

```text
heatedFloorArea = nfl × heatedSharePercent / 100
heatedSharePercent = heatedFloorArea / nfl × 100
```

Der zuletzt geänderte manuelle Wert führt den jeweils anderen nach. Die beheizte Nutzfläche wird höchstens auf die verwendete NFL begrenzt.

### Hüllflächen und Volumen

```text
footprintScale = √(effectiveFootprint / footprintArea)
exteriorWallGrossArea = perimeter × footprintScale × heightMedian
windowArea = exteriorWallGrossArea × windowSharePercent / 100
opaqueExteriorWallArea = exteriorWallGrossArea − windowArea
topFloorArea = basementCeilingArea = groundFloorArea = effectiveFootprint
roofSlopeArea = effectiveFootprint / cos(roofPitch)
grossVolume = effectiveFootprint × heightMedian
heatedVolume = grossVolume × heatedSharePercent / 100
```

Die Quadratwurzel-Skalierung setzt eine ähnliche Gebäudeform voraus. Das verwendete Volumen reagiert bewusst auf eine korrigierte BGF/NFL, während `reference.grossVolume` die reine TIRIS-Automatik bewahrt. Ein direkt eingegebenes Volumen hat Vorrang. Das beheizte Volumen ist eine überschlägige Projektgröße und kein normativ bestimmtes Luftvolumen.

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
