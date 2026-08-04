# Dokumentationsindex – Tools für Energieberatung

**Stand:** 04.08.2026  
**Projektmodell:** Schema 2.0

## 1. Grundarchitektur

- `docs/ARCHITEKTUR-V1.md`
- `docs/FACHKONZEPT-BAUTEIL-UND-SANIERUNG-V1.md`
- `docs/NORMVALIDIERUNG-OENORM-B-8110-4-2024.md`
- `docs/NORMVALIDIERUNG-OENORM-B-8110-4-2024.json`

## 2. Standortpass Energie & Gebäude

- `tools/standortpass/docs/METHODIK-UND-DATENBASIS.md`
- `tools/standortpass/docs/WARTUNG-UND-VALIDIERUNG.md`
- `tools/standortpass/docs/26-08-03 GEMEINSAME-DATENBASIS.md`

## 3. Klima am Standort

- `tools/klima/docs/METHODIK-UND-DATENBASIS.md`
- `tools/klima/docs/WARTUNG-INCA-JAHRESPAKETE.md`

Klima und Heizlast bleiben getrennte Oberflächen, verwenden aber dieselbe Klimabasis.

## 4. Heizlast

- `tools/heizlast/docs/METHODIK-UND-ABGRENZUNG.md`
- `tools/heizlast/docs/WARTUNG-UND-VALIDIERUNG.md`

## 5. Energiefluss

### V3 – extern archivierter Referenzstand

Der V3-Code kann nach externer ZIP-Sicherung von der Website entfernt werden. Eine verbleibende Statusnotiz ist nicht für den Betrieb erforderlich.

### V4.3 – funktional abgeschlossen

- `tools/energiefluss-v4/docs/METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
- `tools/energiefluss-v4/docs/WARTUNG-UND-VALIDIERUNG.md`
- `tools/energiefluss-v4/docs/DOKUMENTATIONSSTAND.json`

V4.3 diagnostiziert Verbrauch und Gebäudehülle. Maßnahmen, Kosten und Wirtschaftlichkeit werden bewusst nicht mehr in diese Seite eingebaut.

## 6. Bauteil & Sanierung – Arbeitsversion V0.1

- `docs/FACHKONZEPT-BAUTEIL-UND-SANIERUNG-V1.md`
- `tools/bauteil-sanierung/docs/METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
- `tools/bauteil-sanierung/docs/WARTUNG-UND-DATENPFLEGE.md`
- `docs/TESTPLAN-BAUTEIL-UND-SANIERUNG-V0-1.md`

V0.1 unterstützt Außenwand, Dach, OGD, Kellerdecke und Boden als Dämmmaßnahmen. Fenster und Außentüren sind im Datenmodell vorbereitet und folgen als diskrete Austauschvarianten. Die Kosten- und Fördertabellen sind für den späteren Export der Excel-Masterdatei vorbereitet; bis dahin sind manuelle Projektwerte möglich.

## 7. Gemeinsamer Wirtschaftlichkeitskern

```text
shared/js/domain/economics/economics-core.js
```

Validierung:

```text
node tests/validate-oenorm-b8110-4.js
```

Der Core bildet die für das Fachkonzept benötigten Verfahren der ÖNORM B 8110-4:2024 ab. Die Benutzeroberfläche darf erst nach vollständiger Eingabe-, Bericht- und Quellenlogik als normgemäß bezeichnet werden.

## 8. Zentrale veränderliche Daten

```text
shared/data/
├── addresses/
├── building/
│   ├── existing-u-values.json
│   └── envelope-evaluation.json
├── climate/
│   └── inca/
├── measures/
├── costs/
├── economics/
├── emissions/
├── funding/
└── standards/
    ├── energy-flow-v4-defaults.json
    └── oib/
```

## 9. Dokumentationsregel

Bei fachlichen Änderungen gleichzeitig prüfen:

1. Rechenkern oder Datenpaket
2. sichtbare Beschriftung und Methodik
3. Methodikdokument
4. Wartungs-/Validierungsdokument
5. Modellversion und Datenstand
6. Regressionstest
7. Druckbericht
8. Quellen und Lizenzgrenzen
