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

Zusätzlich JavaScript-Syntax und alle JSON-Dateien prüfen.

## Freigabekriterium

Eine Arbeitsversion wird erst als stabile Version bezeichnet, wenn:

- Pflichtprüfungen bestanden,
- keine Konsolenfehler,
- Import/Export erfolgreich,
- Druck geprüft,
- Dokumentation aktualisiert,
- Datenstände sichtbar,
- bekannte Grenzen dokumentiert sind.
