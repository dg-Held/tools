# Standortpass – gemeinsame Datenbasis

Stand: 03.08.2026

## Ziel

Der Standortpass bleibt eigenständig nutzbar. Adresse, Gebäudeidentität,
Geometrie und manuelle Korrekturen liegen jedoch im gemeinsamen Projektmodell.
Klima, Heizlast und später Energiefluss V4 greifen auf dieselben Werte und
Dienste zu. Keine Tool-Seite muss zuvor geöffnet worden sein.

## Gemeinsame Struktur

```text
shared/
├── data/
│   ├── addresses/
│   ├── climate/
│   │   └── inca/
│   └── standards/
│       └── oib/
├── css/
│   ├── tokens.css
│   ├── components.css
│   └── print.css
└── js/
    ├── paths.js
    ├── data-model.js
    ├── project-migrations.js
    ├── value-resolver.js
    ├── project-store.js
    ├── project-header.js
    ├── project-value-field.js
    └── services/
        ├── address-provider-core.js
        ├── address-provider-bev-local.js
        ├── address-provider-tiris-live.js
        ├── address-provider-hybrid.js
        └── location-core.js
```

## Zuständigkeiten

### `shared/`

- Projektstruktur, Migration und Wertpriorität
- Speicherung, Import und Export
- gemeinsamer Projektkopf und gemeinsame Eingabemuster
- lokaler BEV-Adressindex und TIRIS-Live-Abgleich
- gemeinsam verwendete Datenpfade
- Herkunft, Datenstand und manuelle Korrekturen

### `tools/standortpass/`

- Gebäudeauswahl und ausführliche Geometriedarstellung
- Orthofoto und Kartendarstellungen
- Solar, Umweltwärme und Wärmenetz-Hinweise
- Naturgefahren, Kultur und Radon
- Standortpass-Bericht und dessen fachliches Drucklayout

## Adresspriorität

```text
BEV-Vorschlag
      ↓
TIRIS-Live-Abgleich
      ├── eindeutig → TIRIS verwenden
      └── nicht verfügbar/nicht eindeutig → BEV-Fallback
```

Die Adresse behält Quelle und Datenstand. Dadurch können alle Tools erkennen,
ob der Projektstandort aus TIRIS oder aus dem BEV-Fallback stammt.

## Automatische und manuelle Geometriewerte

Automatische Ausgangswerte und manuelle Korrekturen werden getrennt gespeichert.
Ein manuell bestätigter Wert hat Vorrang, ohne den automatischen Ursprungswert
zu löschen. Nach dem Zurücksetzen wird der aktuelle automatische Wert wieder
wirksam.

Beispiel:

```text
Nutzfläche wirksam:       165 m² – manuell bestätigt
Automatische Abschätzung: 150 m² – aus Gebäudegeometrie
```

Ändert der Nutzer die Nutzfläche später im Energiefluss oder Heizlast-Tool,
erscheint derselbe wirksame Projektwert auch im Standortpass.

## Eigenständige Verwendung

Ohne bestehendes Projekt kann im Standortpass normal eine Adresse gesucht und
ein vollständiger Bericht erstellt werden. Umgekehrt dürfen andere Tools die
gemeinsamen Adress- und Geometriedienste selbst aufrufen, ohne dass der
Standortpass vorher geöffnet wurde.

## Alte kombinierte Toolstruktur

Nach erfolgreichem Gesamttest wird der frühere Ordner
`tools/klima-heizlast/` vollständig entfernt. Der Standortpass besitzt keine
Abhängigkeit mehr zu diesem Ordner. Die großen Adressdateien bleiben unter
`shared/data/addresses/`.
