# Architektur V1 – Tools für Energieberatung

**Stand:** 04.08.2026

## Ziel

Die Tools bleiben einzeln aufrufbar und vollständig nutzbar. Sie verwenden jedoch dieselben Projektdaten, Datenquellen und Berechnungskerne. Keine Tool-Seite muss vorher geöffnet worden sein.

```text
Tool-Oberflächen
Standortpass | Klima | Heizlast | Energiefluss V4
        │
        ▼
Gemeinsamer Project Store
        │
        ├── Standort und Adresse
        ├── Gebäudeidentität und Geometrie
        ├── thermische Gebäudedaten
        ├── Nutzung, Verbrauch und Heizsystem
        ├── Maßnahmen und Szenarien
        └── Quellen, Methoden und manuelle Korrekturen
        │
        ▼
Gemeinsame Dienste, Berechnungskerne und Datenpakete
```

## Unabhängige Tools, gemeinsame Abhängigkeiten

- **Standortpass** ist die ausführlichste Oberfläche für Standort, Gebäudezuordnung und Geometrie. Die verwendeten Adress- und Geometriedienste liegen unter `shared/` und können von anderen Tools direkt aufgerufen werden.
- **Klima** stellt Klimadaten, Jahresverläufe und Kennwerte ausführlich dar.
- **Heizlast** nutzt denselben Klimakern automatisch und zeigt nur den benötigten Klimakontext.
- **Energiefluss V4.2** nutzt Geometrie, Nutzung und Verbrauch aus dem Projekt. Den für den unabhängigen Hüllvergleich notwendigen INCA-Klimakontext kann es direkt berechnen und im selben Projektmodul `modules.klima.climateSummary` ablegen.
- **Energiefluss V3** bleibt als eingefrorener, eigenständiger Referenzstand bestehen.

Eine Abhängigkeit zwischen Fachberechnungen ist zulässig; eine Abhängigkeit zwischen Webseiten ist nicht erforderlich.

## Projektmodell Version 2

Wichtige gemeinsame Pfade:

```text
project
location
building.identity
building.geometry
building.thermal
usage.household
consumption.heating
systems.heating
measures
scenarios
modules
cache
```

### Wertpriorität

```text
manuell bestätigt
  vor amtlich automatisch
  vor abgeleitet
  vor Fallback
```

Ein Projektwert enthält mehrere Kandidaten. Der wirksame Wert wird zentral aufgelöst. Eine manuelle Korrektur löscht den automatischen Ursprungswert nicht. Beim Zurücksetzen wird nur der manuelle Kandidat entfernt.

### Ein Wert existiert nur einmal

Beispiele:

```text
building.geometry.heatedFloorArea
building.geometry.grossFloorArea
building.geometry.windowArea
building.thermal.envelope.exteriorWall.uValue
usage.household.persons
consumption.heating.annualEnergy
```

Eine Tool-Oberfläche darf diese Werte anzeigen oder ändern, aber keine parallele private Kopie als neue Wahrheit führen.

### Quellen-Snapshot, Eingabe und Ergebnis

- **Quellen-Snapshots** wie TIRIS-Gebäudepolygon, Objekt-ID und automatische Geometrie werden gespeichert, damit eine bestätigte Zuordnung nach Neuladen oder Import wiederhergestellt werden kann.
- **Manuelle Eingaben** werden dauerhaft gespeichert und haben Vorrang.
- **Berechnungsergebnisse** werden grundsätzlich neu aus Eingaben abgeleitet. Ein Modul darf einen dokumentierten Ergebnis-Snapshot mit Modellversion und Eingabe-Fingerprint speichern, er ist jedoch nicht die neue fachliche Eingabe.

## Adresswechsel

Bei einer abweichenden Adresse wird zentral unterschieden:

- **Adresse korrigieren:** bestätigte Nutzerwerte bleiben erhalten; standortabhängige amtliche und abgeleitete Werte werden neu ermittelt.
- **Neues Projekt starten:** Gebäude-, Nutzungs-, Verbrauchs- und Ergebnisdaten werden nicht auf das neue Gebäude übertragen.
- **Abbrechen:** Projekt bleibt unverändert.

## Gemeinsame Daten

```text
shared/data/
├── addresses/
├── climate/
│   ├── datenstand.json
│   └── inca/
│       ├── manifest.json
│       └── yearly/
└── standards/
    ├── energy-flow-v4-defaults.json
    └── oib/
        ├── nat-tirol.js
        ├── nat-tirol.json
        ├── tnat13-tirol.js
        └── tnat13-tirol.json
```

Die INCA-Jahrespakete werden von Klima, Heizlast und dem kompakten Klimakontext in Energiefluss V4.2 gemeinsam genutzt.

## Gemeinsame JavaScript-Schichten

```text
shared/js/
├── paths.js
├── data-model.js
├── project-migrations.js
├── value-resolver.js
├── project-store.js
├── project-header.js
├── project-value-field.js
├── services/
│   ├── address-provider-*.js
│   ├── building-geometry-service.js
│   └── location-core.js
├── domain/
│   ├── climate/
│   ├── heating/
│   └── energy-flow/
└── tools/
    └── climate-heating-app.js
```

- `services/` beschafft oder standardisiert externe/amtliche Daten.
- `domain/` enthält Fachberechnungen ohne DOM und ohne eigene Tool-Oberfläche.
- Tool-JavaScript bindet Projektwerte, UI, Rechenkern und Druck zusammen.

## Gemeinsame Gestaltung

```text
shared/css/
├── tokens.css
├── components.css
├── print.css
└── climate-heating.css
```

- Neue Farben werden zuerst als semantische Variable in `tokens.css` ergänzt.
- Projektkopf, Buttons und gemeinsame Projektmuster liegen in `components.css`.
- Tool-CSS enthält nur fach- oder darstellungsspezifische Regeln.
- Drucken/PDF wird oben im Projektkopf und unten am Bericht angeboten.

## Maßnahmen und Szenarien

Bestand und Maßnahme werden getrennt gespeichert. Ein späteres zentrales Maßnahmenobjekt soll dieselbe Maßnahme in Energiefluss, Wirtschaftlichkeit und Sanierungsfahrplan verwenden. Zielwerte kommen aus versionierten Tabellen; Sowiesokosten und energetische Mehrkosten werden getrennt geführt.
