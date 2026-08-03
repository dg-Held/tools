# Energiefluss V4 – Methodik und Berechnungsgrundlagen

**Modellversion:** 4.0.0  
**Fallback-Datenstand:** 03.08.2026

## 1. Zweck

Energiefluss V4 ist eine überschlägige Beratungshilfe. Das Tool verbindet den tatsächlich eingegebenen Heizenergieverbrauch mit gemeinsamen Projektwerten wie Gebäudegeometrie, Nutzfläche, Personenzahl und Bestands-U-Werten.

Es ist **kein Energieausweis**, keine normgemäße Heizlastberechnung und keine detaillierte Bauteilberechnung.

## 2. Grundprinzip

Der eingegebene Verbrauch bleibt die feste Bilanzbasis. Geometrie und U-Werte verteilen den verbleibenden Hüllverlust nachvollziehbar auf die Bauteile.

Dadurch gilt:

- Eine Änderung eines Bestands-U-Werts verändert in der Bestandsansicht nicht heimlich den gemessenen Gesamtverbrauch.
- Sie verändert die Verteilung der Verluste auf die Bauteile.
- Für spätere Sanierungsmaßnahmen kann dieselbe Ausgangsbilanz mit einem unveränderten Kalibrierfaktor verwendet werden.

## 3. Herkunft und Priorität der Werte

Für gemeinsame Projektwerte gilt:

1. manuell bestätigt,
2. amtlich automatisch,
3. abgeleitet,
4. sichtbarer Fallback.

Eine manuelle Korrektur löscht den automatischen Ursprungswert nicht. Mit „↺“ kann wieder auf den automatischen Wert zurückgesetzt werden.

## 4. Verbrauch und Nutzwärme

### 4.1 Nutzwärme gesamt

```text
Nutzwärme gesamt = Heizenergieverbrauch × Jahresnutzungsgrad
```

### 4.2 Warmwasser

Wenn Warmwasser im eingegebenen Verbrauch enthalten ist:

```text
Warmwasser = Personen × 1.000 kWh/(Person·a)
```

### 4.3 Raumwärme

```text
Raumwärme = Nutzwärme gesamt − Warmwasser
```

Ein negatives Ergebnis wird auf null begrenzt und als Warnung ausgegeben.

## 5. Verbrauchsbezogener HWB

```text
HWB aus Verbrauch = Raumwärme / Bruttogeschoßfläche
```

### 5.1 Raumtemperaturkorrektur

```text
Faktor Raumtemperatur = 1 + (Raumtemperatur − 20 °C) × 0,06
```

### 5.2 Korrektur des beheizten Anteils

```text
Faktor beheizter Anteil = 1 + (beheizter Anteil − 100 %) × 0,005
```

### 5.3 Korrigierter HWB

```text
HWB korrigiert = HWB aus Verbrauch
                 / Faktor Raumtemperatur
                 / Faktor beheizter Anteil
```

Diese Korrektur ist eine bewusst einfache Beratungsnäherung.

## 6. Energiegewinne

### 6.1 Interne Gewinne

```text
Interne Gewinne = 2,7 W/m² × beheizte Nutzfläche × 8,76 h·kWh/Wa
```

Vereinfacht:

```text
Interne Gewinne = 2,7 × beheizte Nutzfläche × 8,76 kWh/a
```

### 6.2 Solare Gewinne

Die V4-Ausgangslogik entspricht der bisherigen V3-Näherung:

```text
Solare Gewinne = 175 kWh/(m²a) × Fensterfläche × 0,70
```

Die 0,70 bildet den vereinfachten Glasanteil ab. Orientierung, Verschattung und tatsächlicher g-Wert werden in V4 noch nicht einzeln berücksichtigt.

### 6.3 Gesamte Energieeinträge

```text
Gesamteinträge = Heizenergieverbrauch
                 + interne Gewinne
                 + solare Gewinne
```

## 7. Verluste außerhalb der Bauteile

### 7.1 Anlagenverlust

```text
Anlagenverlust = Heizenergieverbrauch − Nutzwärme gesamt
```

### 7.2 Lüftungsverlust

```text
Lüftungsverlust = 10 kWh/(m³a) × konditioniertes Gebäudevolumen
```

```text
konditioniertes Volumen = Gebäudevolumen × beheizter Anteil
```

### 7.3 Verbleibender Hüllverlust

```text
Rest Hülle inklusive Wärmebrücken
= Gesamteinträge
  − Anlagenverlust
  − Warmwasser
  − Lüftungsverlust
```

## 8. Bauteile und Wärmebrücken

Wärmebrücken werden als 7,5 % der Bauteilverluste angesetzt.

```text
Bauteilverlust = Rest Hülle / 1,075
Wärmebrücken = Bauteilverlust × 0,075
```

Für jedes aktivierte Bauteil wird berechnet:

```text
UA = Fläche × U-Wert
```

Die Aufteilung erfolgt nach dem jeweiligen Anteil an der UA-Summe:

```text
Bauteilverlust_i
= gesamter Bauteilverlust × UA_i / Summe UA
```

Aktuell vorgesehene Bauteile:

- Außenwand opak,
- Fenster,
- oberste Geschoßdecke,
- Dach,
- Kellerdecke beziehungsweise Decke gegen unbeheiztes Untergeschoß,
- Boden beziehungsweise unterster Abschluss.

OGD und Dach sowie Kellerdecke und Boden dürfen nur gleichzeitig aktiv sein, wenn sie tatsächlich unterschiedliche Teilflächen beschreiben.

## 9. Geometrie

V4 verwendet vorrangig gemeinsame Projektwerte aus dem Standortpass. Fehlen diese, werden sichtbare Fallbacks verwendet.

Aktuelle Grundannahmen der Fallbackgeometrie:

- 2 oberirdische Geschoße,
- Höhenmodul 3,2 m,
- NFL-Faktor 75 % der BGF,
- Fensteranteil 20 % der Brutto-Außenwand,
- quadratischer Grundriss, wenn kein Umfang vorhanden ist.

Diese Werte werden nicht als amtlich dargestellt.

## 10. Bestands-U-Werte

Fehlen bestätigte U-Werte, schlägt V4 grobe Profile vor:

- unsanierter Altbau,
- teilsanierter Bestand,
- sanierter Bestand,
- neuerer Standard / Neubau.

Die Profile dienen nur als sichtbare Startwerte. Der Berater soll sie anhand der vorhandenen Unterlagen beziehungsweise seiner Bestandsabschätzung korrigieren.

Die Werte stehen zentral in:

```text
shared/data/standards/energy-flow-v4-defaults.json
```

Damit können sie später aktualisiert werden, ohne den JavaScript-Rechenkern zu verändern.

## 11. Rückgabe an die gemeinsame Projektbasis

V4 speichert dauerhaft:

- manuelle Korrekturen der Projektwerte,
- bestätigte Bestands-U-Werte,
- Auswahl der aktiven Hüllflächen,
- verbrauchsbezogenen HWB als abgeleiteten Wert,
- jährliche Nutzwärme Raumheizung als abgeleiteten Wert.

Zusätzlich wird unter `modules.energiefluss` ein Berechnungssnapshot mit Modellversion, Fallback-Datenstand, Eingabe-Fingerprint und Ergebniszusammenfassung abgelegt.

Der Snapshot dokumentiert die letzte Auswertung. Maßgeblich bleiben die Eingaben; bei Änderungen wird neu gerechnet.

## 12. Grenzen

Besonders zu prüfen sind:

- ungewöhnlich hohe oder niedrige Raumtemperaturen,
- nur teilweise beheizte Gebäude,
- leerstehende oder zeitweise genutzte Gebäude,
- nicht im Verbrauch enthaltene Zusatzheizungen,
- stark schwankende Anlagenwirkungsgrade,
- unbekannter Warmwasseranteil,
- stark abweichende solare Gewinne,
- geometrisch komplexe Gebäude,
- unzutreffende Zuordnung von OGD/Dach oder Kellerdecke/Boden.

Die Ergebnisse sollen als nachvollziehbare Größenordnung und Gesprächsgrundlage verwendet werden.
