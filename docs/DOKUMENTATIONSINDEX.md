# Dokumentationsindex – Tools für Energieberatung

**Stand:** 05.08.2026  
**Projektmodell:** Schema 2.0

## 1. Grundarchitektur

- `docs/ARCHITEKTUR-V1.md`
- `docs/FACHKONZEPT-BAUTEIL-UND-SANIERUNG-V1.md`
- `docs/NORMVALIDIERUNG-OENORM-B-8110-4-2024.md`
- `docs/NORMVALIDIERUNG-OENORM-B-8110-4-2024.json`

## 2. Standortpass Energie & Gebäude

- `tools/standortpass/docs/METHODIK-UND-DATENBASIS.md`
- `tools/standortpass/docs/WARTUNG-UND-VALIDIERUNG.md`

## 3. Klima am Standort

- `tools/klima/docs/METHODIK-UND-DATENBASIS.md`
- `tools/klima/docs/WARTUNG-INCA-JAHRESPAKETE.md`

Klima und Heizlast sind getrennte Oberflächen, verwenden aber dieselbe Klimabasis.

## 4. Heizlast

- `tools/heizlast/docs/METHODIK-UND-ABGRENZUNG.md`
- `tools/heizlast/docs/WARTUNG-UND-VALIDIERUNG.md`

## 5. Energiefluss

### V3 – extern archivierter Referenzstand

Der V3-Code kann nach externer ZIP-Sicherung von der Website entfernt bleiben.

### V4.4 – funktional abgeschlossen

- `tools/energiefluss-v4/docs/METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
- `tools/energiefluss-v4/docs/WARTUNG-UND-VALIDIERUNG.md`
- `tools/energiefluss-v4/docs/DOKUMENTATIONSSTAND.json`

Energiefluss diagnostiziert Verbrauch und Gebäudehülle. Maßnahmen und Wirtschaftlichkeit werden im eigenständigen Tool „Bauteil & Sanierung“ untersucht.

## 6. Bauteil & Sanierung – Arbeitsversion V0.4

- `docs/AENDERUNGEN-BAUTEIL-UND-SANIERUNG-V0-4.md`
- `docs/INSTALLATION-BAUTEIL-UND-SANIERUNG-V0-4.md`
- `docs/TESTPLAN-BAUTEIL-UND-SANIERUNG-V0-4.md`
- `tools/bauteil-sanierung/docs/METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
- `tools/bauteil-sanierung/docs/WARTUNG-UND-DATENPFLEGE.md`
- `tools/bauteil-sanierung/docs/DOKUMENTATIONSSTAND.json`

V0.4 unterstützt:

- Außenwand,
- Dach/Dachschräge,
- oberste Geschoßdecke,
- Kellerdecke,
- Boden gegen Erdreich,
- Fenster als diskrete Austauschmaßnahme.

Außentüren bleiben im Datenmodell vorbereitet.

## 7. Gemeinsamer Wirtschaftlichkeitskern

```text
shared/js/domain/economics/economics-core.js
```

Validierung:

```text
node tests/validate-oenorm-b8110-4.js
```

## 8. Gemeinsamer Maßnahmenkern

```text
shared/js/domain/measures/envelope-renovation-core.js
```

Version V0.4 unterstützt kontinuierliche Dämmdicken und diskrete Austauschvarianten.

## 9. Zentrale Daten

```text
shared/data/
├── building/
├── climate/
├── costs/
├── economics/
├── emissions/
├── measures/
│   ├── envelope-targets.json
│   └── exchange-variants.json
└── standards/
    ├── economics/
    │   └── component-lifetimes.json
    └── oib/
        └── envelope-u-values.json
```

Förderungen sind keine automatisch gepflegten Standarddaten. Sie werden projektbezogen als Landes-, Bundes- und sonstige Förderung bestätigt.

## 10. Dokumentationsregel

Bei fachlichen Änderungen gleichzeitig prüfen:

1. Rechenkern oder Datenpaket,
2. sichtbare Beschriftung und Methodik,
3. Methodikdokument,
4. Wartungs-/Validierungsdokument,
5. Modellversion und Datenstand,
6. Regressionstest,
7. Druckbericht,
8. Quellen und Lizenzgrenzen.
