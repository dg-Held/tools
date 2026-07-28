# Energiefluss im Gebäude – Wartung und Validierung

**Dokumentversion:** 1.0  
**Toolstand:** V3  
**Stand:** 28.07.2026

---

## 1. Wartungsbedarf

Das Tool verwendet keine externen Live-Daten.

Es gibt daher keinen regelmäßigen Datenupdate-Zyklus wie beim Tool „Klima & Heizlast“.

Wartung ist erforderlich bei:

- Änderung einer Formel,
- Änderung eines Modellparameters,
- Änderung der Eingabefelder,
- Änderung der Druckausgabe,
- Änderung der fachlichen Interpretation,
- größerem Website- oder Browserupdate.

---

## 2. Kritische Modellparameter

Bei jeder Änderung bewusst prüfen:

```text
BGF-Faktor                  1,20
Gebäudehöhe                 3,0 m
Fensteranteile              15 / 25 / 40 %
Glasanteil                  70 %
interne Gewinne             2,7 W/m²
solare Gewinne              175 kWh/m² Glasfläche
Lüftung                     10 kWh/m³a
Wärmebrücken                7,5 % Bauteilverluste
Warmwasser                  1.000 kWh/Person·a
Raumtemperaturkorrektur     6 %/K
Flächenkorrektur            0,5 % je %-Punkt
```

Diese Werte sind nicht als unveränderliche Normwerte zu behandeln.

---

## 3. Regressionstest mit Standardwerten

Eingaben:

```text
NF                         120 m²
beheizt                     90 %
Fensteranteil               25 %
Personen                     4
HEB                     25.000 kWh/a
Warmwasser              inkludiert
JNG                         0,85
Raumtemperatur              22 °C
```

Erwartete Größenordnung:

```text
BGF                    144 m²
Fensterfläche           36,0 m²
Glasfläche              25,2 m²
Volumen                 432 m³
KRW                     1,120
KBF                     0,950

Interne Gewinne       2.838 kWh/a
Solare Gewinne        4.410 kWh/a
Heizenergie          25.000 kWh/a
Summe Einträge       32.248 kWh/a

Lüftung               4.320 kWh/a
Anlage                3.750 kWh/a
Warmwasser            4.000 kWh/a
Bauteile             ca. 18.771 kWh/a
Wärmebrücken         ca. 1.408 kWh/a
Summe Verluste       ca. 32.248 kWh/a

HWB Verbrauch        ca. 120 kWh/m²a
HWB korrigiert       ca. 113 kWh/m²a
```

---

## 4. Testfälle

### Fall A – Warmwasser exkludiert

Prüfen:

- Warmwasserzeile wird ausgeblendet,
- QWW = 0,
- HWB Verbrauch wird ohne WW-Abzug berechnet.

### Fall B – JNG = 1,00

Prüfen:

```text
Anlagenverlust = 0
```

### Fall C – niedriger JNG

Prüfen:

- Anlagenverlust steigt,
- Nutzwärme für HWB sinkt,
- Bilanz bleibt geschlossen.

### Fall D – Fensteranteil ändern

Prüfen:

```text
15 % < 25 % < 40 %
```

für:

- Fensterfläche,
- Glasfläche,
- solare Gewinne.

### Fall E – Raumtemperatur

Prüfen:

```text
20 °C → KRW 1,000
22 °C → KRW 1,120
```

### Fall F – beheizter Anteil

Prüfen:

```text
100 % → KBF 1,000
90 %  → KBF 0,950
80 %  → KBF 0,900
```

### Fall G – unplausible Eingabe

Eine Kombination erzeugen, bei der:

```text
QRest < 0
```

Prüfen:

- Warnhinweis sichtbar,
- negative Restgröße wird nicht stillschweigend als plausibel dargestellt.

---

## 5. Drucktest

Nach größeren Änderungen prüfen:

- A4 Hochformat,
- 100 % Skalierung,
- Browser-Kopf-/Fußzeilen aus,
- Projektdaten lesbar,
- vier Grunddatenfelder pro Zeile,
- Hausgrafik vorhanden,
- Balken nicht abgeschnitten,
- HWB-Bereich lesbar,
- keine Eingabeelemente außerhalb des Druckbereichs.

---

## 6. Browserprüfung

Mindestens:

- Firefox Desktop,
- Chromium/Chrome Desktop,
- Smartphone-Breite.

Prüfen:

- Eingabeänderungen aktualisieren sofort,
- Bereichsschieber beheizte Fläche,
- Select Fensteranteil,
- Datumsvorbelegung,
- Druckknopf,
- Hausgrafik-Fallback.

---

## 7. Fachliche Änderungsregel

Bei Änderung eines Modellparameters müssen gleichzeitig geprüft werden:

1. `energiefluss.js`
2. Beschriftung/Formelhinweis in `index.html`
3. `METHODIK-UND-BERECHNUNGSGRUNDLAGEN.md`
4. Regressionstest
5. Ausdruck

Die Formel im sichtbaren Tool und die tatsächliche JavaScript-Berechnung dürfen nie auseinanderlaufen.

---

## 8. Empfohlene Versionierung

```text
V3.x   Layout-/Textkorrekturen ohne Methodikänderung
V4     Änderung einer oder mehrerer Berechnungsannahmen
```

Eine Änderung beispielsweise von:

```text
solare Gewinne 175 → anderer Wert
```

oder:

```text
Lüftung 10 kWh/m³a → anderes Modell
```

ist eine fachliche Änderung und sollte als neue Rechenversion dokumentiert werden.

---

## 9. Langfristig mögliche Verbesserungen

Nur bei tatsächlichem Beratungsbedarf erwägen:

- klarere Bezeichnung „Summe Energieeinträge“ statt „Energiebedarf“,
- wählbare Gebäudeart für interne Gewinne,
- differenziertere Warmwasserannahme,
- Fensterorientierung und Verschattung,
- Luftwechsel / Lüftungsanlage,
- explizite Eingabe der BGF statt pauschaler Umrechnung,
- Kennzeichnung aller Faustformeln direkt über Info-Tooltips.

Diese Erweiterungen würden das Tool komplexer machen und sollten nur umgesetzt werden, wenn der zusätzliche Beratungsnutzen die geringere Einfachheit rechtfertigt.
