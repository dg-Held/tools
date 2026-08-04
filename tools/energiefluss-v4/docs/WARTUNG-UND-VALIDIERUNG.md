# Energiefluss V4.3 – Wartung und Validierung

**Toolstand:** V4.3  
**Modellversion:** 4.3.0  
**Stand:** 04.08.2026

## Zuständigkeiten

### Rechenkern

```text
shared/js/domain/energy-flow/energy-flow-core.js
```

### Geometrie- und Nutzungsfallbacks

```text
shared/data/standards/energy-flow-v4-defaults.json
```

### Bauperioden-U-Werte

```text
shared/data/building/existing-u-values.json
```

### Bewertung und Zielorientierung

```text
shared/data/building/envelope-evaluation.json
```

### Oberfläche

```text
tools/energiefluss-v4/index.html
tools/energiefluss-v4/energiefluss-v4.js
tools/energiefluss-v4/energiefluss-v4.css
```

## Pflichtprüfungen

1. V4 ohne Standortpass öffnen und Adresse/Gebäude auswählen.
2. Projekt mit vorhandener Standortpass-Geometrie öffnen.
3. Baujahr eingeben und Änderung der U-Wert-Fallbacks prüfen.
4. Baujahr zurücksetzen und Zustandsfallback prüfen.
5. Gebäudezustand manuell wählen; dieser muss den Bauperiodenvorschlag übersteuern.
6. Manuelle U-Werte müssen immer Vorrang behalten.
7. Fensterflächen in 5-m²-, übrige Flächen in 10-m²-Schritten prüfen.
8. U-Wert ändern: UA und Verlustverteilung reagieren; gemessener Verbrauch bleibt unverändert.
9. Klimawerte direkt berechnen und Hüllvergleich prüfen.
10. U-Wert-Tabelle muss unterhalb der Ergebnisgrafik stehen.
11. Prominente Links zu Klima, Heizlast und Standortpass dürfen nicht mehr angezeigt werden.
12. JSON exportieren/importieren.
13. Druck auf zwei A4-Seiten prüfen.
14. V3 unverändert öffnen.

## Fachliche Kontrollfälle

### Bauperiode

Beispiel Baujahr 1970:

- Außenwand 1,20 W/m²K
- Fenster 3,00 W/m²K
- Dach/OGD 0,55 W/m²K
- Kellerdecke/Boden 1,35 W/m²K

Beispiel Baujahr 2005:

- Außenwand 0,35 W/m²K
- Fenster 1,70 W/m²K
- Dach/OGD 0,20 W/m²K
- Kellerdecke/Boden 0,40 W/m²K

### Priorität

```text
manueller U-Wert
> manuell gewählter Gebäudezustand
> Bauperiodenvorschlag
> automatischer Zustandsfallback
```

### Bilanzschluss

```text
Gesamteinträge − Gesamtverluste ≈ 0 kWh/a
```

### Verbrauch und Hüllvergleich

Eine Änderung von U-Wert oder Fläche verändert den rechnerischen Hüllvergleich, aber nicht die gemessene Verbrauchsbilanz.

## Pflege der U-Wert-Daten

Bei einer Aktualisierung:

1. Excel-Master beziehungsweise freigegebene Fachdaten aktualisieren.
2. JSON-Dateien neu erzeugen beziehungsweise aktualisieren.
3. `data_date`, Quelle und Änderungsgrund dokumentieren.
4. Bauperioden- und Ampeltest wiederholen.
5. Keine rechtliche Mindestanforderung als dauerhafte Empfehlung ausgeben.

## Versionspflege

Bei fachlicher Änderung Modellversion erhöhen und aktualisieren:

- sichtbarer Methodikbereich
- Methodikdokument
- Wartungsdokument
- Dokumentationsstand
- Testplan
- Druckfuß und Snapshot
