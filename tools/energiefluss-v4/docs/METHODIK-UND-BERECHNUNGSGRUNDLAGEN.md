# Energiefluss V4.3 – Methodik und Berechnungsgrundlagen

**Toolstand:** V4.3  
**Modellversion Energiefluss:** 4.3.0  
**Datenstand Bestands-U-Werte:** 04.08.2026  
**Dokumentstand:** 04.08.2026

## 1. Zweck und Abschlussstatus

Energiefluss V4.3 ist eine überschlägige Beratungshilfe. Es zeigt, wie sich der eingegebene Heizenergieverbrauch auf Nutzwärme, Gebäudehülle, Lüftung, Warmwasser und Anlagenverluste verteilt. Zusätzlich plausibilisiert ein unabhängiger Hüllvergleich die Größenordnung des Verbrauchs.

Das Tool ist funktional abgeschlossen. Maßnahmenoptimierung, Kosten und Wirtschaftlichkeit werden bewusst im eigenständigen Tool **„Bauteil & Sanierung“** umgesetzt.

Es ist kein Energieausweis, keine normgemäße Heizlastberechnung und keine detaillierte Bauteilberechnung.

## 2. Seitenlogik

1. Projekt- und Verbrauchsbasis kompakt prüfen
2. Energiefluss und Plausibilitätscheck
3. Gebäudehülle mit Flächen und Bestands-U-Werten
4. Methodik, Annahmen und Grenzen

Prominente Querverweise zu Standortpass, Klima und Heizlast wurden entfernt. Benötigte Klimakennwerte können direkt im Energiefluss berechnet werden.

## 3. Zwei getrennte Rechenwege

### 3.1 Verbrauchsbasierte Energiebilanz

Der eingegebene Verbrauch bleibt die feste farbige Bilanzbasis. U-Werte und Flächen verteilen den verbleibenden Verlust der Gebäudehülle proportional zu `U × A`. Eine Änderung des U-Werts verändert die Verteilung, nicht den gemessenen Gesamtverbrauch.

### 3.2 Unabhängiger Hüllvergleich

Zusätzlich wird aus `U × A`, INCA-Klima, Lüftung, Wärmebrücken, Gewinnen, Warmwasser und Jahresnutzungsgrad ein rechnerischer Verbrauch gebildet. Dieser Wert ist nicht am Verbrauch kalibriert und dient ausschließlich der Plausibilisierung.

## 4. Herkunft und Priorität

```text
manuell bestätigt → amtlich/übernommen → abgeleitet → Fallback
```

Eine manuelle Korrektur löscht den automatischen Ursprungswert nicht. Mit „↺“ wird auf den nächsten automatischen Kandidaten zurückgesetzt.

## 5. Bestands-U-Werte

### 5.1 Priorität

1. manuell bestätigter U-Wert
2. übernommener/amtlicher U-Wert
3. Bauperiodenvorschlag
4. grober Zustandsfallback

### 5.2 Bauperioden

Die Vorschläge nach Jahr der Baubewilligung liegen in:

```text
shared/data/building/existing-u-values.json
```

Bauperioden:

- vor 1900
- 1900–1944
- 1945–1959
- 1960–1981
- 1982–1998
- 1999–2008
- 2009–2026

Das Baujahr ist optional. Wurde der grobe Gebäudezustand manuell gewählt, hat dieser Zustandsfallback Vorrang vor der Bauperiode. Konkrete Sanierungen müssen über die tatsächlichen beziehungsweise fachlich abgeschätzten U-Werte abgebildet werden.

### 5.3 Bewertung

Ampelgrenzen sowie Empfehlung und ambitionierter Zielwert liegen in:

```text
shared/data/building/envelope-evaluation.json
```

Die Bewertung dient der Orientierung. Rechtliche und förderbezogene Werte sind nur versionierte Prüfhinweise und keine Beratungsempfehlung.

## 6. Flächen und Rundung

Um Scheingenauigkeit zu vermeiden:

- Fenster auf 5 m²
- Außenwand, OGD, Dach, Kellerdecke und Boden auf 10 m²

Die gerundeten Werte werden angezeigt und in `U × A` verwendet. Der feinere automatische Quellenwert bleibt erhalten.

## 7. Verbrauch, Nutzwärme und Warmwasser

```text
Q_Nutz = HEB × η
```

Wenn Warmwasser enthalten ist:

```text
Q_WW = Personen × 1.000 kWh/(Person·a)
Q_Raum = max(Q_Nutz − Q_WW, 0)
Q_Anlage = max(HEB − Q_Nutz, 0)
```

## 8. Verbrauchsbezogener HWB

```text
HWB_Verbrauch = Q_Raum / BGF
K_T = 1 + (T_Raum − 20 °C) × 0,06
K_beheizt = 1 + (beheizter Anteil − 100 %) × 0,005
HWB_korrigiert = HWB_Verbrauch / K_T / K_beheizt
```

Die Korrektur ist eine Beratungsnäherung.

## 9. Gewinne und Lüftung

```text
Q_intern = 2,7 W/m² × beheizte Nutzfläche × 8,76
Q_solar = 175 kWh/(m²a) × Fensterfläche × 0,70 × Nutzungsfaktor
V_konditioniert = Gebäudevolumen × beheizter Anteil / 100
Q_Lüftung = 10 kWh/(m³a) × V_konditioniert
```

Orientierung, Verschattung, g-Wert und Luftwechsel werden nicht detailliert modelliert.

## 10. Gebäudehülle in der Verbrauchsbilanz

```text
Q_Rest,Hülle+WB = Q_Ein − Q_Anlage − Q_WW − Q_Lüftung
Q_Bauteile = max(Q_Rest,Hülle+WB, 0) / 1,075
Q_WB = Q_Bauteile × 0,075
UA_i = U_i × A_i
Kalibrierfaktor = Q_Bauteile / ΣUA_i
Q_Bauteil,i = UA_i × Kalibrierfaktor
```

Die eingerückten Bauteile sind die Aufschlüsselung der Gebäudehülle und werden nicht zusätzlich summiert.

## 11. Unabhängiger Hüllvergleich

Zur Bilanztemperatur 15 °C:

```text
Vollbenutzungsstunden
= Σ max(0, (15 °C − T_a,h) / (15 °C − NAT))

HGT = Vollbenutzungsstunden × (15 °C − NAT)
Q_Transmission = ΣUA × HGT / 1.000
Q_WB,rech = Q_Transmission × 0,075
Q_Raum,rech = max(Q_Transmission + Q_WB,rech + Q_Lüftung − Q_intern − Q_solar, 0)
HEB_rechnerisch = (Q_Raum,rech + Q_WW) / η
Abweichung = (HEB_rechnerisch − HEB_gemessen) / HEB_gemessen × 100
```

Die Abweichung wird auf 5-Prozent-Schritte gerundet.

## 12. Aktive Hüllflächen

- Außenwand opak
- Fenster
- oberste Geschoßdecke
- Dach
- Kellerdecke / Decke gegen unbeheiztes Untergeschoß
- Boden / unterster Abschluss

OGD und Dach beziehungsweise Kellerdecke und Boden dürfen nur gleichzeitig aktiv sein, wenn sie unterschiedliche Teilflächen beschreiben.

## 13. Fallbackgeometrie

Fehlen Projektwerte:

- 2 oberirdische Geschosse
- Höhenmodul 3,2 m
- NFL-Faktor 75 % der BGF
- Fensteranteil 20 % der Brutto-Außenwand
- quadratischer Grundriss, wenn kein Umfang bekannt ist

## 14. Gemeinsame Projektbasis

Dauerhaft gespeichert werden:

- manuelle Projektkorrekturen
- Baujahr / Jahr der Baubewilligung, sofern eingegeben
- bestätigte U-Werte
- aktive Hüllflächen
- verbrauchsbezogener korrigierter HWB als abgeleiteter Wert
- jährliche Nutzwärme Raumheizung als abgeleiteter Wert
- kompakter Klimakontext

Unter `modules.energiefluss` liegt ein Ergebnis-Snapshot mit Modellversion, Datenstand und Eingabe-Fingerprint. Er dokumentiert den Stand, ersetzt aber nicht die Eingaben.

## 15. Grenzen

- kein Energieausweis
- keine detaillierte Bauteilschichtung
- keine exakte solare Bilanz
- keine Luftwechselberechnung
- pauschaler Warmwasserbedarf
- pauschale Wärmebrücken
- Bauperiodenwerte nur Fallbacks
- INCA als 1-km-Raster
- Plausibilitätsvergleich nicht als exakter Sollverbrauch interpretieren
