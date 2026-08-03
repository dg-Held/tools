# Standortpass – gemeinsame Datenbasis

Stand: 03.08.2026

## Ziel

Der Standortpass ist eigenständig nutzbar, verwendet für allgemeine Funktionen
aber dieselbe technische Basis wie Klima & Heizlast. Es gibt keine direkten
Dateiverweise vom Standortpass in den Ordner `tools/klima-heizlast/` mehr.

## Gemeinsame Dateien

```text
shared/
├── data/
│   └── addresses/
└── js/
    ├── data-model.js
    ├── project-store.js
    ├── project-header.js
    └── services/
        ├── address-provider-core.js
        ├── address-provider-bev-local.js
        ├── address-provider-tiris-live.js
        ├── address-provider-hybrid.js
        └── location-core.js
```

## Zuständigkeiten

### `shared/`

- Projektstruktur und Herkunftsfelder
- Speicherung, Import und Export
- gemeinsame Projektkopfzeile
- lokaler BEV-Adressindex
- TIRIS-Live-Abgleich
- Höhenabfrage aus dem TIRIS-DGM

### `tools/standortpass/`

- Gebäudegeometrie und Gebäudeauswahl
- Gebäudeabschätzungen
- Orthofoto und Kartendarstellungen
- Solar, Umweltwärme und Wärmenetz-Hinweis
- Naturgefahren, Kultur und Radon
- Standortpass-Bericht und Drucklayout

## Adresspriorität

```text
BEV-Vorschlag
      ↓
TIRIS-Live-Abgleich
      ├── eindeutig → TIRIS verwenden
      └── nicht verfügbar/nicht eindeutig → BEV-Fallback
```

Die gespeicherte Adresse behält ihre Quelle und ihren Datenstand. Dadurch können
andere Werkzeuge erkennen, ob der Projektstandort aus TIRIS oder aus dem
BEV-Fallback stammt.

## Eigenständige Verwendung

Der Standortpass benötigt kein vorher ausgefülltes anderes Werkzeug. Ohne
bestehendes Projekt kann eine Adresse normal gesucht und ein vollständiger
Standortbericht erstellt werden. Vorhandene Projektdaten werden nur als Komfort
übernommen.

## Übergangsbrücken

Die folgenden Dateien sind nach erfolgreichem Abschlusstest nicht mehr nötig:

```text
tools/klima-heizlast/address-provider-core.js
tools/klima-heizlast/address-provider-bev-local.js
tools/klima-heizlast/location-core.js
tools/klima-heizlast/data/addresses/
```

Sie werden erst in einem eigenen Aufräumschritt gelöscht, nachdem beide Tools
alle Einzel- und Übergabetests bestanden haben.
