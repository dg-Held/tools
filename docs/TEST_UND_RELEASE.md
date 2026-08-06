# Test und Release

**Stand:** 05.08.2026

## Installation kleiner Austauschpakete

1. Website-Hauptordner sichern.
2. ZIP entpacken.
3. Inhalt des Paketordners über den Website-Hauptordner kopieren.
4. Gleichnamige Dateien ersetzen.
5. Verschieben/Löschen nur nach separater Liste durchführen.
6. Browser mit `Strg + F5` neu laden.

## Pflichtprüfungen

### Gemeinsames Projekt

- Projekttitel/ID bleiben über alle Tools erhalten.
- JSON exportieren, neues Projekt, JSON importieren.
- Adresse korrigieren und neues Projekt starten.
- manuelle Werte bleiben vorrangig; Zurücksetzen stellt Automatik wieder her.

### Geometrie

Mit einem Gebäude mit Dachprojektion und Medianhöhe testen:

1. reine Automatik,
2. Geschoßzahl manuell,
3. BGF manuell,
4. NFL manuell,
5. beheizte NFL größer als NFL,
6. manuelles Bruttovolumen,
7. einzelne Werte zurücksetzen.

Erwartung:

- Automatikreferenz bleibt unverändert sichtbar.
- verwendete Kette folgt nur bis zum nächsten manuellen Wert.
- Bruttovolumen ändert sich nicht durch Geschoße/BGF.
- beheizte NFL ist nie größer als NFL.

### Bauteil & Sanierung

- alle opaken Bauteile rechnen,
- Fenster: Rahmenmaterialien und diskrete Varianten,
- Haustür: Anzahl × Fläche je Tür für Energie, Anzahl × Stückpreis für Kosten,
- fehlender U-Wert blockiert Berechnung und wird Berry markiert,
- eigene SVGs ersetzen Fallback vollständig,
- Förderung und Sowiesokosten,
- Speichern der Maßnahme,
- Ausdruck mit Farben und Infografik.

### Excel→JSON-Datenpipeline

1. Master-Excel außerhalb des Website-Ordners ablegen.
2. `BAUTEIL_DATEN_PRUEFEN.bat` ausführen; es darf nichts verändert werden.
3. Anzahl aktiver Zielwerte, Baujahreswerte und λ-Werte kontrollieren.
4. Befüllte, aber inaktive Kosten-/Preiszeilen müssen als Warnung erscheinen.
5. `BAUTEIL_DATEN_AUFBEREITEN.bat` ausführen.
6. `shared/data/bauteil-data-manifest.json` prüfen.
7. Vorherige JSON-Dateien müssen unter `BAUTEIL_DATEN_BACKUPS/` neben der Exceldatei gesichert sein.
8. Bauteil & Sanierung öffnen und Kosten, Energiepreis, CO₂-Faktor, Zielwerte und Quellenstatus stichprobenartig vergleichen.
9. Leere optionale Excelbereiche dürfen vorhandene JSON-Dateien nicht überschreiben.
10. Git-Diff beziehungsweise Dateivergleich vor dem Upload prüfen.

### Klima/Heizlast/Energiefluss

- Adresse und Klima laden,
- INCA-Zeitraum/Datenstand,
- Heizlastdruck eine Seite,
- Energieflussdruck zwei Seiten,
- Bauteillinks öffnen richtiges Bauteil.

## Automatisierte Tests

```text
node tests/validate-project-derived-values.js
node tests/validate-envelope-renovation-core.js
```

Zusätzlich JavaScript-Syntax und alle JSON-Dateien prüfen. Für die Datenpipeline außerdem `python tools/data-build/bauteil_data_export.py --help` testen.

## Freigabekriterium

Eine Arbeitsversion wird erst als stabile Version bezeichnet, wenn:

- Pflichtprüfungen bestanden,
- keine Konsolenfehler,
- Import/Export erfolgreich,
- Druck geprüft,
- Dokumentation aktualisiert,
- Datenstände sichtbar,
- bekannte Grenzen dokumentiert sind.

## Ergänzende Regressionen V1.1 / Geometriekette V1.3

Vor Freigabe zusätzlich prüfen:

- Info-Popups öffnen ausschließlich über das `i`-Symbol; das Eingabefeld selbst darf keinen Hoverbereich auslösen oder verdecken.
- Heizlast: BGF-Vorschlag erscheint sofort als `beheizte Nutzfläche / 0,75`, bleibt überschreibbar und kann auf Automatik zurückgesetzt werden.
- Standortpass: Vor „Standort analysieren“ bleiben Ergebnisbereiche ausgeblendet.
- Geschoßzahl und NFL aktualisieren BGF, wirksame Grundfläche, Hüllflächen und Volumen gemäß Geometriekette V1.3.
- Beheizter Anteil und beheizte Nutzfläche werden bidirektional synchronisiert und auf 0–100 % beziehungsweise höchstens NFL begrenzt.
- Fensteranteil startet bei 25 %, läuft von 10 bis 50 % und aktualisiert Fenster- und opake Außenwandfläche.
- Automatische Referenzwerte unter `building.geometry.reference.*` bleiben trotz manueller Korrekturen unverändert.
- WMS-/Datenquellen-Details brechen auf schmalen Ansichten um und verursachen keinen horizontalen Seitenüberlauf.
