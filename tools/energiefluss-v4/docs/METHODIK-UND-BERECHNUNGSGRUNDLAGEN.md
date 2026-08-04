# Energiefluss V4.2 – Methodik und Berechnungsgrundlagen

**Modellversion:** 4.2.0  
**Fallback-Datenstand:** 03.08.2026  
**Dokumentstand:** 04.08.2026

## 1. Zweck

Energiefluss V4.2 ist eine überschlägige Beratungshilfe. Das Tool verbindet den tatsächlich eingegebenen Heizenergieverbrauch mit gemeinsamen Projektwerten wie Gebäudegeometrie, Nutzfläche, Personenzahl und Bestands-U-Werten.

Es ist **kein Energieausweis**, keine normgemäße Heizlastberechnung und keine detaillierte Bauteilberechnung.

## 2. Zwei bewusst getrennte Rechenwege

### 2.1 Verbrauchsbasierte Energiebilanz

Der eingegebene Verbrauch bleibt die feste farbige Bilanzbasis. U-Werte und Flächen verteilen den verbleibenden Verlust der Gebäudehülle proportional zu `U × A` auf die Bauteile. Eine Änderung des Bestands-U-Werts verändert damit die Verlustverteilung, aber nicht heimlich den gemessenen Gesamtverbrauch.

### 2.2 Unabhängiger Hüllvergleich

Zusätzlich wird – sofern Klimakennwerte vorhanden sind – ein unabhängiger rechnerischer Verbrauch aus `U × A`, INCA-Klima, Lüftung, Wärmebrücken, Gewinnen, Warmwasser und Jahresnutzungsgrad gebildet. Dieser Wert wird nicht am Verbrauch kalibriert und dient ausschließlich der Plausibilisierung.

Die Klimakennwerte können direkt im Energiefluss über **„Klimawerte berechnen“** erzeugt werden. Dabei werden dieselben OIB- und INCA-Kerne wie im Klima-Tool verwendet und derselbe Projektpfad `modules.klima.climateSummary` befüllt.

## 3. Herkunft und Priorität

```text
manuell bestätigt → amtlich automatisch → abgeleitet → Fallback
```

Eine manuelle Korrektur löscht den automatischen Ursprungswert nicht. Mit „↺“ wird auf den nächsten verfügbaren automatischen Kandidaten zurückgesetzt.

## 4. Flächen und Rundung

Um Scheingenauigkeit zu vermeiden, werden die im Energiefluss verwendeten Hüllflächen bewusst gerundet:

- Fenster: auf 5 m²,
- Außenwand, OGD, Dach, Kellerdecke und Boden: auf 10 m².

Diese gerundeten Werte werden sowohl angezeigt als auch in `U × A` verwendet. Der feinere automatische Quellenwert bleibt im Projektfeld erhalten.

## 5. Verbrauch, Nutzwärme und Warmwasser

```text
Q_Nutz = HEB × η
```

mit:

- `HEB`: eingegebener Heizenergieverbrauch,
- `η`: Jahresnutzungsgrad.

Wenn Warmwasser enthalten ist:

```text
Q_WW = Personen × 1.000 kWh/(Person·a)
```

```text
Q_Raum = max(Q_Nutz − Q_WW, 0)
Q_Anlage = max(HEB − Q_Nutz, 0)
```

## 6. Verbrauchsbezogener HWB

```text
HWB_Verbrauch = Q_Raum / BGF
```

Korrekturfaktoren:

```text
K_T = 1 + (T_Raum − 20 °C) × 0,06
K_beheizt = 1 + (beheizter Anteil − 100 %) × 0,005
```

```text
HWB_korrigiert = HWB_Verbrauch / K_T / K_beheizt
```

Die Korrektur ist eine einfache Beratungsnäherung.

## 7. Gewinne

### 7.1 Interne Gewinne

```text
Q_intern = 2,7 W/m² × beheizte Nutzfläche × 8,76
```

Der Faktor 8,76 wandelt die Jahresstunden in kWh je W um.

### 7.2 Solare Gewinne

```text
Q_solar = 175 kWh/(m²a) × Fensterfläche × 0,70 × Nutzungsfaktor
```

Der aktuelle Nutzungsfaktor ist 1,00. Orientierung, Verschattung und tatsächlicher g-Wert werden noch nicht einzeln modelliert.

### 7.3 Bilanzsumme

```text
Q_Ein = HEB + Q_intern + Q_solar
```

## 8. Lüftung und konditioniertes Volumen

```text
V_konditioniert = Gebäudevolumen × beheizter Anteil / 100
Q_Lüftung = 10 kWh/(m³a) × V_konditioniert
```

Das ist eine pauschale Jahresannahme und keine Luftwechselberechnung.

## 9. Gebäudehülle in der Verbrauchsbilanz

```text
Q_Rest,Hülle+WB
= Q_Ein − Q_Anlage − Q_WW − Q_Lüftung
```

Wärmebrücken werden als 7,5 % der Bauteilverluste angesetzt:

```text
Q_Bauteile = max(Q_Rest,Hülle+WB, 0) / 1,075
Q_WB       = Q_Bauteile × 0,075
```

Für jedes aktive Bauteil:

```text
UA_i = U_i × A_i
UA_gesamt = Σ UA_i
```

```text
Kalibrierfaktor = Q_Bauteile / UA_gesamt
Q_Bauteil,i = UA_i × Kalibrierfaktor
```

Die eingerückten Bauteile sind die Aufschlüsselung der Gebäudehülle und werden nicht zusätzlich zur Gebäudehülle summiert.

## 10. Unabhängiger Hüllvergleich

Die mittleren Vollbenutzungsstunden werden aus den INCA-Jahrespaketen übernommen. Zur Bilanztemperatur 15 °C gilt:

```text
Vollbenutzungsstunden
= Σ max(0, (15 °C − T_a,h) / (15 °C − NAT))
```

Daraus:

```text
HGT = Vollbenutzungsstunden × (15 °C − NAT)
```

### 10.1 Transmission

```text
Q_Transmission = UA_gesamt × HGT / 1.000
```

### 10.2 Wärmebrücken, Lüftung und Gewinne

```text
Q_WB,rech = Q_Transmission × 0,075
```

```text
Q_Raum,rech
= max(Q_Transmission + Q_WB,rech + Q_Lüftung
      − Q_intern − Q_solar, 0)
```

### 10.3 Rechnerischer Heizenergieverbrauch

```text
HEB_rechnerisch = (Q_Raum,rech + Q_WW) / η
```

```text
Abweichung [%]
= (HEB_rechnerisch − HEB_gemessen) / HEB_gemessen × 100
```

Die Darstellung rundet die Abweichung bewusst auf 5-Prozent-Schritte.

## 11. Aktive Hüllflächen

Aktuell vorgesehen:

- Außenwand opak,
- Fenster,
- oberste Geschoßdecke,
- Dach,
- Kellerdecke/Decke gegen unbeheiztes Untergeschoß,
- Boden/unterster Abschluss.

OGD und Dach beziehungsweise Kellerdecke und Boden dürfen nur gleichzeitig aktiv sein, wenn sie tatsächlich unterschiedliche Teilflächen beschreiben.

## 12. Fallbackgeometrie

Fehlen Projektwerte, werden sichtbare Annahmen verwendet:

- 2 oberirdische Geschosse,
- Höhenmodul 3,2 m,
- NFL-Faktor 75 % der BGF,
- Fensteranteil 20 % der Brutto-Außenwand,
- quadratischer Grundriss, wenn kein Umfang vorhanden ist.

## 13. Bestands-U-Werte

Die Startprofile liegen zentral in:

```text
shared/data/standards/energy-flow-v4-defaults.json
```

Aktuelle Profile:

- unsanierter Altbau,
- teilsanierter Bestand,
- sanierter Bestand,
- neuerer Standard/Neubau.

Sie sind provisorische Beratungs-Fallbacks und müssen mit der vorgesehenen U-Wert-Broschüre beziehungsweise belastbaren Quellen abgeglichen werden. Ein bestätigter U-Wert hat immer Vorrang.

## 14. Gemeinsame Projektbasis

V4 speichert dauerhaft:

- manuelle Projektkorrekturen,
- bestätigte U-Werte,
- aktive Hüllflächen,
- verbrauchsbezogenen korrigierten HWB als abgeleiteten Projektwert,
- jährliche Nutzwärme Raumheizung als abgeleiteten Projektwert,
- kompakten Klimakontext, wenn er direkt berechnet wurde.

Unter `modules.energiefluss` wird ein Ergebnis-Snapshot mit Modellversion, Datenstand, Eingabe-Fingerprint und Ergebniszusammenfassung abgelegt. Er dokumentiert den Berechnungsstand, ersetzt aber nicht die Eingaben.

## 15. Grenzen

- keine normative Energieausweisberechnung,
- keine detaillierte Bauteilschichtung,
- keine exakte solare Bilanz,
- keine Luftwechselberechnung,
- pauschaler Warmwasserbedarf,
- pauschale Wärmebrücken,
- U-Wert-Profile noch fachlich zu validieren,
- INCA als 1-km-Raster,
- Vergleich dient zur Plausibilisierung und darf nicht als exakter Sollverbrauch interpretiert werden.
