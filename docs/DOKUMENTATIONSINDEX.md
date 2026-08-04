# Dokumentationsindex – Tools für Energieberatung

**Stand:** 04.08.2026  
**Projektmodell:** Schema 2.0  
**Zweck:** Zentrale Übersicht über Methodik, Wartung, Datenstände und Zuständigkeiten.

## 1. Grundarchitektur

- `docs/ARCHITEKTUR-V1.md`  
  Gemeinsames Projektmodell, Wertpriorität, gemeinsame Dienste, Berechnungskerne und Gestaltungsgrundlagen.

## 2. Standortpass Energie & Gebäude

- `tools/standortpass/docs/METHODIK-UND-DATENBASIS.md`
- `tools/standortpass/docs/WARTUNG-UND-VALIDIERUNG.md`
- `tools/standortpass/docs/26-08-03 GEMEINSAME-DATENBASIS.md`  
  Historie der Umstellung auf die gemeinsame Projektbasis.

Der Standortpass ist die ausführlichste Oberfläche für Adresse, Gebäudezuordnung, Geometrie, Solar, Wärmeversorgung und Standort-/Risikoprüfungen. Andere Tools dürfen dieselben gemeinsamen Dienste direkt verwenden, ohne dass der Standortpass vorher geöffnet wurde.

## 3. Klima am Standort

- `tools/klima/docs/METHODIK-UND-DATENBASIS.md`
- `tools/klima/docs/WARTUNG-INCA-JAHRESPAKETE.md`
- `tools/klima/tools/README-INCA-JAHRESPAKETE.md`

Klima und Heizlast sind getrennte Tool-Oberflächen. Beide verwenden denselben Klimakern und dieselben jahresweisen INCA-Datenpakete. Energiefluss V4.2 darf den benötigten kompakten Klimakontext ebenfalls direkt berechnen.

## 4. Heizlast

- `tools/heizlast/docs/METHODIK-UND-ABGRENZUNG.md`
- `tools/heizlast/docs/WARTUNG-UND-VALIDIERUNG.md`

Das Tool kombiniert verbrauchsbasierte, flächenbezogene und optional HWB-basierte Orientierungen. Es ersetzt keine normgemäße Heizlastberechnung.

## 5. Energiefluss

### V3 – eingefrorener Referenzstand

- `tools/energiefluss/docs/METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
- `tools/energiefluss/docs/FORMELBLATT-V3.md`
- `tools/energiefluss/docs/WARTUNG-UND-VALIDIERUNG.md`
- `tools/energiefluss/docs/DOKUMENTATIONSSTAND.json`
- `tools/energiefluss/docs/DOKUMENTATIONSSTATUS-V3.md`

V3 bleibt unverändert und eigenständig. Sie dient weiterhin als stabiler Referenzstand.

### V4.2 – gemeinsame Projektbasis

- `tools/energiefluss-v4/docs/METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
- `tools/energiefluss-v4/docs/WARTUNG-UND-VALIDIERUNG.md`
- `tools/energiefluss-v4/docs/DOKUMENTATIONSSTAND.json`

V4.2 nutzt gemeinsame Projektwerte, gerundete Hüllflächen, Bestands-U-Werte, eine verbrauchsbasierte Bilanz und einen unabhängigen U×A-/INCA-Plausibilitätsvergleich.

## 6. Zentrale veränderliche Daten

```text
shared/data/
├── addresses/                         lokaler BEV-Adressindex
├── climate/
│   ├── datenstand.json
│   └── inca/                          jahresweise INCA-Pakete
└── standards/
    ├── energy-flow-v4-defaults.json   V4-Fallbacks und U-Wert-Profile
    └── oib/                           NAT und TNAT,13
```

## 7. Dokumentationsregel

Bei fachlichen Änderungen müssen gleichzeitig geprüft und bei Bedarf aktualisiert werden:

1. Rechenkern oder Datenpaket,
2. sichtbare Beschriftung und Methodikbereich im Tool,
3. Methodikdokument,
4. Wartungs-/Validierungsdokument,
5. Modellversion oder Datenstand,
6. Regressionstest und Druckausgabe.

Reine Layoutänderungen brauchen keine neue fachliche Modellversion. Änderungen von Formeln, Konstanten, Datenprioritäten oder fachlicher Interpretation erfordern eine neue Modellversion und einen dokumentierten Test.
