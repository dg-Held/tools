# Energiefluss V4 – Wartung und Validierung

## Trennung der Zuständigkeiten

### Rechenkern

```text
shared/js/domain/energy-flow/energy-flow-core.js
```

Enthält ausschließlich die Berechnung. Keine DOM-Zugriffe, keine Speicherung und keine Adressabfrage.

### Veränderliche Fallbackdaten

```text
shared/data/standards/energy-flow-v4-defaults.json
```

Enthält Startwerte, U-Wert-Profile und sichtbare Beratungsannahmen.

### Gemeinsame Gebäudegeometrie

```text
shared/js/services/building-geometry-service.js
```

Wird von Standortpass und Energiefluss V4 gemeinsam verwendet.

### Oberfläche und Projektaustausch

```text
tools/energiefluss-v4/energiefluss-v4.js
```

Bindet Projektwerte, Eingaben, Rechenkern, Anzeige und Druck zusammen.

## Pflichtprüfungen nach Änderungen

1. JavaScript-Syntax prüfen.
2. Projekt ohne vorherigen Standortpass öffnen.
3. Projekt mit Standortpass-Geometrie öffnen.
4. Nutzfläche, Verbrauch und U-Werte manuell ändern.
5. Seite neu laden und Werte kontrollieren.
6. Einen Wert zurücksetzen und automatischen Ursprung kontrollieren.
7. JSON exportieren und erneut importieren.
8. Klima und Heizlast öffnen und gemeinsame Werte vergleichen.
9. Druckvorschau auf zwei A4-Seiten prüfen.
10. V3 öffnen und sicherstellen, dass sie unverändert funktioniert.

## Fachliche Kontrollfälle

### Bilanzschluss

```text
Gesamteinträge − Gesamtverluste ≈ 0 kWh/a
```

Rundungsabweichungen unter 1 kWh/a sind unkritisch.

### U-Wert-Verteilung

Bei unverändertem Verbrauch muss eine U-Wert-Änderung:

- die UA-Summe verändern,
- die Verlustverteilung verändern,
- den gemessenen Gesamtverbrauch nicht verändern.

### Manuelle Priorität

Ein manueller Wert muss nach einer automatischen Geometrieaktualisierung erhalten bleiben. Der automatische Wert muss weiterhin als Ursprungswert sichtbar sein.

### Oberer und unterer Abschluss

Bei gleichzeitig aktiver OGD und Dach beziehungsweise Kellerdecke und Boden muss eine Warnung erscheinen.

## Versionspflege

Bei einer fachlichen Änderung des Rechenkerns:

1. `MODEL_VERSION` erhöhen,
2. Methodikdokument aktualisieren,
3. Kontrollfälle erneut durchführen,
4. Datenstand im Ausdruck kontrollieren.

Bei einer reinen Aktualisierung von Fallbackdaten:

1. JSON-Datei ändern,
2. `data_date` aktualisieren,
3. fachliche Quelle beziehungsweise Begründung dokumentieren,
4. kein JavaScript ändern, sofern die Struktur gleich bleibt.
