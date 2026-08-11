# Architektur und Datenmodell

**Stand:** 11.08.2026

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
building.geometry.windowSharePercent
building.geometry.windowArea
building.geometry.opaqueExteriorWallArea
building.geometry.grossVolume
building.geometry.reference.*
building.thermal.heatedSharePercent
building.thermal.heatedVolume
```

`building.geometry.reference.*` speichert die reine automatische Referenz ohne manuelle Korrekturen. Die Hauptfelder speichern die verwendete Kette mit manuellen Prioritäten.

## 5. Gemeinsame Begriffe und Energiepfade

Gleiche fachliche Werte werden in allen Tools gleich bezeichnet und nur einmal im Projektmodell gespeichert:

```text
Baujahr / Baubewilligung           → building.profile.constructionYear
Nutzfläche (NFL)                    → building.geometry.usableFloorArea
Davon beheizt                       → building.thermal.heatedSharePercent
Beheizte Nutzfläche                 → building.geometry.heatedFloorArea
Bruttogeschoßfläche (BGF)           → building.geometry.grossFloorArea
Oberirdische Geschoße               → building.geometry.storeysAboveGround
Fensterflächenanteil                → building.geometry.windowSharePercent
Heizenergieverbrauch (kWh/a)        → consumption.heating.annualEnergy
Nutzwärmefaktor (JNG / JAZ)         → systems.heating.usefulHeatFactor
Warmwasser enthalten                → systems.heating.hotWaterIncluded
Personen                             → usage.household.persons
Gebäudezustand                       → building.thermal.condition
Externer Referenz-HWB                 → building.thermal.independentHwb
Thermische Hülle / relevant          → building.thermal.envelope.<bauteil>.enabled
```

`building.thermal.independentHwb` bezeichnet ausschließlich einen **extern eingegebenen unabhängigen Referenz-HWB**, zum Beispiel aus einem Energieausweis oder einer separaten Berechnung. Das Feld ist nicht der intern berechnete **„HWB aus U-Werten“** des Energieflusses. Dieser entsteht im Rechenkern aus Hülle, Klima, Lüftung und Gewinnen und wird als Rechenergebnis neu abgeleitet; er wird nicht als zweiter manueller Projekt-HWB unter `independentHwb` gespeichert.

Der Begriff **Nutzwärmefaktor** ist der gemeinsame Oberbegriff: Bei Kesseln entspricht er dem Jahresnutzungsgrad, bei Wärmepumpen der Jahresarbeitszahl. Werte über 1,0 sind daher zulässig. Energiefluss stellt in diesem Fall die Differenz zwischen Nutzwärme und bezogener Heizenergie als Umweltwärme dar, damit die Bilanz geschlossen und fachlich verständlich bleibt.

Oberflächen dürfen Synonyme nicht als neue Speicherfelder anlegen. Ein manueller Wert hat gemäß Resolver-Priorität Vorrang; automatische Vorschläge bleiben als Herkunftskandidat erhalten.

## 6. Geometrieabhängigkeiten

Die gemeinsame Ableitung läuft unter `building-geometry-v1.5`. Sie hält eine unveränderte automatische Referenz und eine verwendete Kette mit manuellen Prioritäten parallel vor.

### Feste Erstannahmen

```text
storeyHeightModule = 3,2 m
usableFloorAreaFactor = 0,75
defaultWindowShare = 20 %
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
exteriorWallGrossArea = technische, abgeleitete Brutto-Fassade
windowArea = exteriorWallGrossArea × windowSharePercent / 100
opaqueExteriorWallArea = exteriorWallGrossArea − windowArea

Nutzerseitige Definition: Außenwand = `opaqueExteriorWallArea` (ohne Fenster). `exteriorWallGrossArea` ist keine manuelle Beratereingabe mehr, sondern nur technische Ableitungs-/Referenzgröße. Fenster und opake Außenwand werden als getrennte gemeinsame Projektwerte an Energiefluss, Bauteil & Sanierung und später Wirtschaftlichkeit weitergegeben.
topFloorArea = basementCeilingArea = groundFloorArea = effectiveFootprint
roofSlopeArea = footprintArea / cos(roofPitch)
grossVolume = effectiveFootprint × heightMedian
heatedVolume = grossVolume × heatedSharePercent / 100
```

Der Fensterflächenanteil ist ein gemeinsamer Projektwert. Eine direkt bestätigte Fensterfläche hat grundsätzlich Vorrang; wird der Verhältnisregler im Energiefluss bewusst geändert, werden ältere manuelle Fenster-/opake Wandflächen zurückgesetzt, damit die neue Verhältnisannahme wirksam wird.

Die Quadratwurzel-Skalierung setzt eine ähnliche Gebäudeform voraus. Das verwendete Volumen reagiert bewusst auf eine korrigierte BGF/NFL, während `reference.grossVolume` die reine TIRIS-Automatik bewahrt. Ein direkt eingegebenes Volumen hat Vorrang. Das beheizte Volumen ist eine überschlägige Projektgröße und kein normativ bestimmtes Luftvolumen.

## 7. Maßnahmenmodell

Eine Maßnahme enthält mindestens:

- ID und Kategorie,
- betroffenes Bauteil/System,
- Relevanz für die thermische Hülle samt gemeinsamem Projektpfad,
- Bestand und Zielvariante,
- technische Wirkung,
- Energie-/CO₂-Wirkung,
- Kosten, Sowiesokosten und Förderung,
- Wirtschaftlichkeit,
- Komfortwirkung,
- Quellen- und Modellversionen,
- Kommentar und Zeitstempel.

Energiefluss, Wirtschaftlichkeit und Sanierungsfahrplan verwenden dieselbe Maßnahme.

Automatisch erzeugte Hüllvorschläge verwenden IDs nach dem Muster:

```text
auto-envelope-<componentId>-recommended
auto-envelope-<componentId>-economic
auto-envelope-<componentId>-ambitious
```

Sie tragen `autoGenerated: true`, `status: automatic-proposal` und `reviewStatus: not-reviewed`. Zusätzlich wird `thermalEnvelope.relevant` gespeichert. Der gemeinsame Hüllstatus liegt unter `building.thermal.envelope.<bauteil>.enabled`; Energiefluss und Bauteiltool lesen und schreiben damit denselben Wert. Nur relevante Bauteile werden in automatische Hüllpakete aufgenommen. Drei Szenarien bündeln die Maßnahmen:

```text
envelope-package-recommended
envelope-package-economic
envelope-package-ambitious
```

Manuell im Bauteiltool bestätigte Maßnahmen behalten ihre bisherige ID `envelope-<componentId>` und werden von der automatischen Aktualisierung nicht überschrieben. Das Paketmodul speichert einen Fingerprint der relevanten Geometrie-, U-Wert-, Energie-, Kosten- und Finanzgrundlagen.

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

## 10. Optionale statische Bauteilgrafiken

Eigene SVG-Grafiken für `Bauteil & Sanierung` liegen optional unter `assets/svg/tools/bauteil-sanierung/`. Fehlt eine Grafik, verwendet das Tool seine integrierte Fallback-Grafik; die Dateien sind daher kein Laufzeit-Pflichtbestand. Empfohlen sind quadratische oder leicht hochformatige SVGs ohne externe Schrift- oder Bildabhängigkeiten.

Namensschema je Bauteil:

```text
bestand-<bauteil>.svg
sanierung-<bauteil>.svg
```

Verwendete Bezeichnungen sind insbesondere `aussenwand`, `ogd`, `dach`, `kellerdecke`, `boden`, `fenster` und `aussentuer`.

## Semantikmigration Außenwand v1.5

Beim Laden älterer Projekte wird eine manuelle Standortpass-Eingabe unter `building.geometry.exteriorWallGrossArea` einmalig als opake Außenwand interpretiert und nach `building.geometry.opaqueExteriorWallArea` verschoben. Dadurch werden bereits fensterbereinigte Energieausweisflächen nicht erneut um die Fensterfläche reduziert. Die technische Brutto-Fassade bleibt als abgeleitete Referenz erhalten.
