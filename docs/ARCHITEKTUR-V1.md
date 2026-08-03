# Architektur V1 – Tools für Energieberatung

Stand: 03.08.2026

## Ziel

Die Tools bleiben einzeln aufrufbar. Sie verwenden jedoch dieselben Projektdaten,
Datenquellen und Berechnungskerne. Keine Tool-Seite muss vorher geöffnet worden
sein.

```text
Tool-Oberflächen
  Standortpass | Klima | Heizlast | später Energiefluss V4
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
Gemeinsame Berechnungskerne und Datenpakete
```

## Unabhängige Tools, gemeinsame Abhängigkeiten

- **Klima** zeigt die Klimadaten ausführlich.
- **Heizlast** verwendet dieselben Klimadaten automatisch, zeigt davon aber nur
  den für die Heizlast notwendigen Kontext.
- **Standortpass** ist die ausführlichste Oberfläche für Standort und Geometrie.
  Die zugrunde liegenden Dienste liegen trotzdem unter `shared/`.
- **Energiefluss V4** wird später direkt auf dieselben Gebäude-, Nutzungs- und
  Verbrauchswerte zugreifen.

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

Ein Projektwert enthält mehrere Kandidaten. Der wirksame Wert wird zentral
aufgelöst. Beispiel:

```json
{
  "__type": "energy-tools-field",
  "unit": "m²",
  "value": 165,
  "origin": "manual",
  "automaticValue": 152,
  "manualValue": 165,
  "candidates": {
    "derived": {
      "value": 152,
      "source": "Standortpass"
    },
    "manual": {
      "value": 165,
      "source": "Nutzereingabe"
    }
  }
}
```

Wird die manuelle Korrektur zurückgesetzt, wird nur der Kandidat `manual`
entfernt. Der automatische Wert bleibt erhalten.

## Migration bestehender Projekte

Der localStorage-Schlüssel bleibt absichtlich:

```text
energy-tools-project-v1
```

Bestehende Projekte werden beim Laden automatisch auf Schema 2 migriert.
Dadurch gehen bisher gespeicherte Projekte nicht allein wegen des Umbaus
verloren. Ein JSON-Export vor dem Austausch bleibt trotzdem empfohlen.

## Gemeinsame Daten

```text
shared/data/
├── addresses/
├── climate/
│   ├── datenstand.json
│   └── inca/
│       ├── manifest.json
│       ├── tiles/
│       └── yearly/
└── standards/
    └── oib/
        ├── nat-tirol.js
        ├── nat-tirol.json
        ├── tnat13-tirol.js
        └── tnat13-tirol.json
```

Die INCA-Jahrespakete werden von Klima und Heizlast gemeinsam genutzt. Das
Aufbereitungsskript schreibt neue Jahre direkt nach
`shared/data/climate/inca/`.

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
├── domain/
│   ├── climate/
│   └── heating/
└── tools/
    └── climate-heating-app.js
```

- `paths.js`: zentrale Datei- und Datenpfade.
- `data-model.js`: Projektschema und Feldstruktur.
- `project-migrations.js`: Übernahme älterer Projektstände.
- `value-resolver.js`: Priorität und Herkunft der Werte.
- `project-store.js`: Speichern, Import, Export und toolübergreifende Änderungen.
- `domain/`: Fachlogik ohne eigene Tool-Oberfläche.
- `tools/`: gemeinsame Steuerung der getrennten Klima-/Heizlastansichten.

## Gemeinsame Gestaltung

```text
shared/css/
├── tokens.css
├── components.css
├── print.css
└── climate-heating.css
```

- Farben, Abstände, Radien und Schatten werden nur in `tokens.css` ergänzt.
- Projektkopf, gemeinsame Buttons und Projektwertfelder liegen in
  `components.css`.
- Druckregeln für den gemeinsamen Projektkopf liegen in `print.css`.
- Tool-CSS enthält nur die fachliche Darstellung des jeweiligen Tools.

## Ergebnisse

Eingaben, Quellen-Snapshots und Entscheidungen werden gespeichert. Aktuelle
Ergebnisse wie Heizlast, Energieeinsparung oder Amortisation werden aus den
Eingaben neu berechnet. Für einen späteren Bericht kann ein dokumentierter
Snapshot mit Datenstand und Modellversion erzeugt werden.
