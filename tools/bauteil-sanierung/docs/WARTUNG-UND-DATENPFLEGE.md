# Bauteil & Sanierung – Wartung und Datenpflege

**Stand:** 05.08.2026  
**Toolstand:** V0.5

## 1. Zentrale Dateien

```text
shared/data/measures/envelope-targets.json
shared/data/measures/exchange-variants.json
shared/data/measures/lambda-values.json
shared/data/measures/co-benefits.json
shared/data/costs/renovation-costs.json
shared/data/standards/economics/component-lifetimes.json
shared/data/standards/oib/envelope-u-values.json
shared/data/economics/financial-defaults.json
shared/data/economics/energy-prices.json
shared/data/emissions/emission-factors.json
```

Förderungen werden nicht als automatisch gepflegte Datensätze geladen. Sie bleiben freie Projektangaben.

## 2. Datenabgrenzung

### Pflege-Excel

Die BAUTEIL-DATEN-MASTER-Datei pflegt insbesondere:

- fachliche Empfehlung und ambitionierten Standard,
- Bestands-U-Werte nach Bauperiode,
- λ-Werte,
- Richtkosten und Sowiesokosten,
- Energiepreise,
- Emissionsfaktoren,
- Finanzannahmen,
- qualitative Komfort- und Ökologiehinweise.

### Feste Standards

- OIB-Prüfwerte: `shared/data/standards/oib/envelope-u-values.json`
- Nutzungsdauern: `shared/data/standards/economics/component-lifetimes.json`

### Projektbezogen

- Landesförderung,
- Bundesförderung,
- sonstige Förderung,
- manuelle Kosten- und Annahmenkorrekturen.

## 3. Fenster- und Haustürdaten

Austauschvarianten:

```text
shared/data/measures/exchange-variants.json
```

Für Fenster und Haustür sind Basis-Austausch, empfohlener Mindeststandard und ambitionierte Variante aktiv. Die konkreten Richtpreise werden über das Kostenmodell `window_replace` den Stufen niedrig, mittel und hoch zugeordnet.

Nutzungsdauer und Instandhaltung:

```text
shared/data/standards/economics/component-lifetimes.json
```

- Holzrahmen: 30 Jahre, 1,0 %/a,
- Aluminiumrahmen: 30 Jahre, 0,5 %/a,
- Kunststoff und Holz-Aluminium: gekennzeichnete Projekt-Fallbacks,
- Haustür: gekennzeichneter Projekt-Fallback.

Bei Änderungen müssen Quelle, Ausgabe, Status und Versionsdatum gemeinsam aktualisiert werden.

## 4. Opake Bauteile

Die Nutzungsdauerwerte der Dämmmaßnahmen bleiben als `project-fallback` gekennzeichnet, solange kein direkt passender, dokumentierter Norm- oder Katalogwert bestätigt wurde. Sie dürfen in der Oberfläche überschrieben werden und dürfen in Berichten nicht als zwingende Normwerte bezeichnet werden.

## 5. Richtkosten

- Quellwerte bleiben exakt dokumentiert.
- Website-Richtpreise werden auf 10 €/m² bereitgestellt.
- Kostenband unten ≤ Mitte ≤ oben.
- Sowiesokosten dürfen Vollkosten nicht überschreiten.
- Fenster werden pro m² Fensterfläche gerechnet.
- Haustüren werden kostenseitig pro Stück und energetisch über die Türfläche gerechnet.

## 6. Eigene SVG-Grafiken

Pfad:

```text
assets/svg/tools/bauteil-sanierung/
```

Die Dateinamen sind in `README.md` dokumentiert. SVGs sollen ohne externe Schrift- oder Bildreferenzen gespeichert werden. Nach Austausch Browsercache mit Strg+F5 leeren.

## 7. Rechenkerne

```text
shared/js/domain/measures/envelope-renovation-core.js
shared/js/domain/economics/economics-core.js
```

Fachformeln dürfen nicht in der Oberfläche dupliziert werden. Änderungen benötigen:

1. Versionsanhebung,
2. Syntaxprüfung,
3. Regressionstest Dämmmaßnahmen,
4. Regressionstest Fenster und Haustür,
5. Prüfung von Projektimport/-export,
6. Druckprüfung,
7. Dokumentationsupdate.

## 8. Validierung nach Datenupdate

1. JSON-Syntax prüfen.
2. IDs auf Eindeutigkeit prüfen.
3. Ziel-U-Werte logisch ordnen.
4. Kostenstufen niedrig ≤ mittel ≤ hoch.
5. Fensterfläche und Bestands-U-Wert aus Energiefluss übernehmen.
6. Rahmenmaterialien und Herkunft der Nutzungsdauer prüfen.
7. Haustürkosten über Stückzahl und Energie über Fläche prüfen.
8. Kostenoptimum und Amortisation getrennt prüfen.
9. Förderungen als Fixbetrag und Prozentwerte testen.
10. Ausdruck ohne vollständige Variantentabelle prüfen.
11. Eigene SVGs und Fallback-Grafik testen.

## 9. Baujahreswerte und Geometrie

Bestands-U-Wert-Vorschläge werden aus `shared/data/building/existing-u-values.json` geladen. Neue Bauteile benötigen dort eine eindeutige Komponentenzuordnung. Die gemeinsame BGF→Volumen-Ableitung liegt in `shared/js/project-store.js`; sie darf nicht noch einmal lokal in anderen Tools dupliziert werden. Der Standortpass zeigt denselben Rechenweg.
