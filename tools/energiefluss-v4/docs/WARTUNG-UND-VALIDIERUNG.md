# Energiefluss V4.2 – Wartung und Validierung

**Modellversion:** 4.2.0  
**Stand:** 04.08.2026

## Zuständigkeiten

### Rechenkern

```text
shared/js/domain/energy-flow/energy-flow-core.js
```

Enthält Berechnung ohne DOM, Speicherung oder Adressabfrage.

### Veränderliche Fallbackdaten

```text
shared/data/standards/energy-flow-v4-defaults.json
```

Enthält Geometrie-, Nutzungs-, Bilanz- und U-Wert-Fallbacks.

### Gemeinsame Klima- und Geometriedienste

```text
shared/js/services/building-geometry-service.js
shared/js/domain/climate/precomputed-climate-core.js
shared/js/domain/climate/oib-nat-core.js
shared/js/domain/climate/oib-tnat13-core.js
```

### Oberfläche

```text
tools/energiefluss-v4/index.html
tools/energiefluss-v4/energiefluss-v4.js
tools/energiefluss-v4/energiefluss-v4.css
```

## Pflichtprüfungen

1. V4 ohne bestehenden Standortpass öffnen.
2. Adresse und TIRIS-Gebäude direkt in V4 auswählen.
3. Projekt mit vorhandener Standortpass-Geometrie öffnen.
4. Automatische Flächen prüfen: Fenster 5-m²-Schritte, übrige Hülle 10-m²-Schritte.
5. Manuelle Fläche eingeben; sie muss auf die jeweilige Schrittweite gerundet und projektweit gespeichert werden.
6. U-Werte ändern; UA und Verlustverteilung müssen reagieren.
7. Gemessener Verbrauch darf durch U-Wert-Änderung nicht verändert werden.
8. „Klimawerte berechnen“ direkt in V4 ausführen.
9. Klima-Seite öffnen: Zeitraum/NAT müssen denselben Projektkontext verwenden.
10. Rechnerischen Verbrauch und Abweichung prüfen.
11. Info-Symbole mit Maus, Tastatur und Antippen prüfen.
12. Wert zurücksetzen und automatischen Ursprung kontrollieren.
13. JSON exportieren/importieren.
14. Druckvorschau auf zwei A4-Seiten prüfen.
15. V3 öffnen und unveränderte Funktion bestätigen.

## Fachliche Kontrollfälle

### Bilanzschluss

```text
Gesamteinträge − Gesamtverluste ≈ 0 kWh/a
```

Abweichungen unter 1 kWh/a sind rundungsbedingt unkritisch.

### Flächenrundung

Beispiele:

```text
Außenwand automatisch 281,83 m² → verwendet 280 m²
Fenster automatisch 37,4 m²     → verwendet 35 m²
Fenster automatisch 38,1 m²     → verwendet 40 m²
```

Der feinere Quellenwert muss als automatischer Kandidat erhalten bleiben.

### Verbrauchsbilanz

Bei unverändertem Verbrauch muss eine U-Wert-Änderung:

- UA-Summe ändern,
- Aufteilung der Gebäudehülle ändern,
- gemessene Bilanzsumme unverändert lassen.

### Unabhängiger Hüllvergleich

Bei vorhandenen Klimawerten muss eine U-Wert- oder Flächenänderung den rechnerischen Verbrauch verändern. Der gemessene Verbrauch bleibt unverändert.

### Manuelle Priorität

Manuelle Werte müssen nach Gebäudeaktualisierung erhalten bleiben. Der automatische Ursprungswert bleibt sichtbar und kann mit „↺“ reaktiviert werden.

### Oberer/unterer Abschluss

Bei gleichzeitig aktiver OGD und Dach beziehungsweise Kellerdecke und Boden muss eine Warnung erscheinen.

## Direkte Klimaberechnung

Testfälle:

- eindeutige Katastralgemeinde: Berechnung erfolgreich,
- mehrere KG ohne bestätigte Auswahl: verständliche Fehlermeldung und Link zum Klima-Tool,
- fehlende Adresse/Koordinaten: Berechnung nicht starten,
- fehlendes Jahrespaket: fehlende Jahre nennen,
- erneute Berechnung: Projekt-Snapshot aktualisieren.

## Versionspflege

Bei fachlicher Änderung:

1. `MODEL_VERSION` erhöhen,
2. Methodikbereich in `index.html` aktualisieren,
3. Methodik- und Wartungsdokumente aktualisieren,
4. Regressionstests durchführen,
5. Ausdruck und Snapshot kontrollieren.

Bei reiner Fallbackdaten-Aktualisierung:

1. JSON ändern,
2. `data_date` aktualisieren,
3. Quelle und Begründung dokumentieren,
4. Regressionsfälle wiederholen.
