# Bauteil & Sanierung – Wartung und Datenpflege

**Stand:** 04.08.2026

## 1. Zentrale Dateien

```text
shared/data/measures/envelope-targets.json
shared/data/measures/lambda-values.json
shared/data/measures/co-benefits.json
shared/data/costs/renovation-costs.json
shared/data/costs/lifetimes.json
shared/data/economics/financial-defaults.json
shared/data/economics/energy-prices.json
shared/data/emissions/emission-factors.json
shared/data/funding/funding.json
```

Diese Dateien sind die zukünftigen Website-Exporte der wartbaren Excel-Masterdatei.

## 2. Aktueller Datenstatus

Bereits befüllt:

- Ziel-U-Werte und Prüfwerte,
- λ-Auswahl,
- qualitative Komforthinweise,
- Rundungsregeln.

Noch bewusst leer:

- Richtkosten,
- Sowiesokosten,
- Nutzungsdauern,
- Energiepreise,
- Emissionsfaktoren,
- Förderungen.

Solange diese Werte fehlen, verwendet das Tool manuelle Projektangaben und kennzeichnet den Zustand sichtbar.

## 3. Pflegeprinzip

- Quellwerte bleiben in Excel exakt erhalten.
- Bereitgestellte Richtpreise werden auf 10 €/m² gerundet.
- Berechnungen verwenden die bereitgestellten Zahlen intern exakt.
- Summen werden erst für Anzeige und Ausdruck auf 500 € gerundet.
- Jeder Datensatz benötigt Quelle, Datenstand, Region und Aktivstatus.
- Förderungen dürfen nur nach bewusster Bestätigung in eine Projektberechnung eingehen.

## 4. Validierung nach Datenupdate

Nach jedem JSON-Export prüfen:

1. JSON-Syntax,
2. eindeutige IDs,
3. aktive Datensätze besitzen Zahlen und Quellen,
4. Kostenband unten ≤ Mitte ≤ oben,
5. Sowiesokosten ≤ Vollkosten,
6. Empfehlung und ambitionierter Zielwert sind plausibel angeordnet,
7. Testprojekt mit Außenwand, Dach und Kellerdecke,
8. Ausdruck und Projekt-Export/-Import.

## 5. Rechenkerne

```text
shared/js/domain/measures/envelope-renovation-core.js
shared/js/domain/economics/economics-core.js
```

Fachformeln dürfen nicht in die Oberfläche dupliziert werden. Änderungen benötigen Versionsanhebung, Tests und Dokumentation.
