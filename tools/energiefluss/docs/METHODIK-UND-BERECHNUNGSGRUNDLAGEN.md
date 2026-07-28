# Energiefluss im Gebäude – Methodik und Berechnungsgrundlagen

**Dokumentversion:** 1.0  
**Toolstand:** V3  
**Stand:** 28.07.2026  
**Charakter:** Überschlägige Beratungs- und Visualisierungshilfe – kein Ersatz für Energieausweis, Heizlast- oder Normberechnung

---

## 1. Zweck des Tools

Das Tool „Energiefluss im Gebäude“ stellt den jährlichen Energiefluss eines Gebäudes stark vereinfacht dar.

Es soll in der Energieberatung vor allem sichtbar machen:

- welche Energie in das Gebäude eingebracht wird,
- welche Verluste rechnerisch gegenüberstehen,
- wie groß die einzelnen Anteile im Verhältnis zueinander sind,
- wie sich Nutzfläche, Fensteranteil, Raumtemperatur, beheizter Flächenanteil, Jahresverbrauch und Jahresnutzungsgrad auf die überschlägige Bilanz auswirken,
- welcher verbrauchsbasierte spezifische Raumwärme-Kennwert daraus abgeleitet werden kann.

Das Tool ist bewusst **anschaulich und überschlägig**. Es berechnet weder den normativen Heizwärmebedarf eines Energieausweises noch eine normgerechte Heizlast.

---

# 2. Grundprinzip

Die Berechnung folgt einer vereinfachten Jahresenergiebilanz:

```text
Energieeinträge
=
interne Gewinne
+ solare Gewinne
+ eingegebener Heizenergieverbrauch

Verluste
=
Bauteilverluste
+ Wärmebrücken
+ Lüftung
+ Anlagenverluste
+ gegebenenfalls Warmwasser
```

Wichtig: Die **Bauteilverluste werden nicht aus U-Werten und Bauteilflächen berechnet**.

Sie entstehen als Restgröße aus der Jahresenergiebilanz.

Damit ist das Tool vor allem eine anschauliche Rückrechnung aus Verbrauch und vereinfachten Annahmen.

---

# 3. Eingaben

## 3.1 Nutzfläche NF

Eingabe:

```text
NF [m²]
```

Sie bildet die Basis für:

- die geschätzte Bruttogrundfläche,
- die internen Gewinne,
- indirekt Fenster- und Glasfläche,
- das Gebäudevolumen.

---

## 3.2 Beheizter Flächenanteil

Eingabe:

```text
beheizt [%]
```

Der Wert beeinflusst den Korrekturfaktor der späteren verbrauchsbasierten HWB-Abschätzung.

Er verändert **nicht** direkt die im Energiefluss dargestellte Nutzfläche oder das Gebäudevolumen.

---

## 3.3 Fensterflächenanteil

Auswahl:

```text
niedrig = 15 % der BGF
mittel  = 25 % der BGF
hoch    = 40 % der BGF
```

Diese Werte sind **Modellannahmen des Tools** und keine Normwerte.

---

## 3.4 Personen

Eingabe:

```text
Anzahl Personen
```

Sie wird nur für den pauschalen Warmwasseranteil verwendet, sofern Warmwasser im eingegebenen Heizenergieverbrauch enthalten ist.

---

## 3.5 Heizenergieverbrauch HEB

Eingabe:

```text
HEB [kWh/a]
```

Der eingegebene Wert wird im Energiefluss zunächst vollständig als Energieeintrag dargestellt.

Über den Jahresnutzungsgrad wird er anschließend aufgeteilt in:

```text
Nutzwärme
+
Anlagenverluste
```

Das Tool setzt voraus, dass der eingegebene Verbrauch und der gewählte Jahresnutzungsgrad zueinander passen.

---

## 3.6 Warmwasser enthalten / nicht enthalten

Auswahl:

```text
inkludiert
nicht inkludiert
```

Ist Warmwasser inkludiert, wird ein pauschaler Warmwasserbedarf von:

```text
1.000 kWh/(Person·a)
```

angesetzt.

Dies ist eine **vereinfachte Beratungsannahme des Tools**.

Ist Warmwasser nicht inkludiert:

```text
QWW = 0
```

---

## 3.7 Jahresnutzungsgrad JNG

Eingabe:

```text
0,01 bis 1,00
```

Der Jahresnutzungsgrad wird verwendet, um den eingegebenen Heizenergieverbrauch in Nutzwärme und Anlagenverluste aufzuteilen.

```text
QNutz = HEB × JNG
```

```text
QAnlage = HEB − HEB × JNG
```

Der JNG ist vom Anwender passend zum betrachteten Heizsystem einzuschätzen.

---

## 3.8 Raumtemperatur

Eingabe:

```text
TRaum [°C]
```

Sie beeinflusst ausschließlich den Korrekturfaktor für den verbrauchsbasierten HWB-Kennwert.

Referenz:

```text
20 °C
```

---

# 4. Abgeleitete Grunddaten

## 4.1 Bruttogrundfläche BGF

```text
BGF = NF × 1,20
```

Der Faktor 1,20 ist eine **vereinfachte Umrechnung des Tools**.

Er ist keine allgemeingültige Definition der Bruttogrundfläche für beliebige Gebäude.

---

## 4.2 Fensterfläche

```text
AFenster = BGF × Fensterflächenanteil
```

Damit ergeben sich je nach Auswahl:

```text
niedrig: AFenster = BGF × 0,15
mittel:  AFenster = BGF × 0,25
hoch:    AFenster = BGF × 0,40
```

---

## 4.3 Glasfläche

```text
AGlas = AFenster × 0,70
```

Der Glasanteil von 70 % ist eine Modellannahme.

Rahmenanteile und unterschiedliche Fenstertypen werden nicht einzeln abgebildet.

---

## 4.4 Gebäudevolumen

```text
V = BGF × 3,0 m
```

Die angenommene mittlere Gebäudehöhe von 3,0 m ist eine Vereinfachung.

---

# 5. Korrekturfaktoren

## 5.1 Korrektur Raumtemperatur KRW

```text
KRW = 1 + (TRaum − 20) × 0,06
```

Beispiele:

```text
20 °C → 1,00
21 °C → 1,06
22 °C → 1,12
```

Der Ansatz von 6 % pro Kelvin ist eine **Beratungsfaustformel des Tools**, keine normative Korrekturformel.

Der Faktor wird nur für den korrigierten HWB-Verbrauchskennwert verwendet.

---

## 5.2 Korrektur beheizte Fläche KBF

```text
KBF = 1 + (beheizt − 100) × 0,005
```

Beispiele:

```text
100 % → 1,000
 90 % → 0,950
 80 % → 0,900
```

Auch dieser Faktor ist eine Modellannahme.

Der korrigierte Kennwert wird durch KBF dividiert und damit auf einen vollständig beheizten Vergleichszustand angenähert.

---

# 6. Energieeinträge

## 6.1 Interne Gewinne

```text
Qintern = 2,7 W/m² × NF × 8.760 h / 1.000
```

Im Code:

```text
Qintern = 2,7 × NF × 8,76
```

Damit entsprechen die internen Gewinne:

```text
23,652 kWh/(m²·a) × NF
```

Der pauschale Ansatz von 2,7 W/m² ist eine Modellannahme für die überschlägige Darstellung.

Personenzahl, Geräte, Beleuchtung und Anwesenheitszeiten werden nicht separat bilanziert.

---

## 6.2 Solare Gewinne

Zuerst:

```text
AGlas = AFenster × 0,70
```

Dann:

```text
Qsolar = 175 × AFenster × 0,70
```

gleichbedeutend mit:

```text
Qsolar = 175 × AGlas
```

Die Zahl 175 ist eine **pauschale solare Jahresannahme des Tools**.

Nicht separat berücksichtigt werden:

- Himmelsrichtung,
- Verschattung,
- g-Wert der Verglasung,
- Fensterneigung,
- lokale Globalstrahlung,
- saisonaler Verlauf.

Der Wert ist daher ausschließlich für eine anschauliche überschlägige Jahresbilanz gedacht.

---

## 6.3 Heizenergie

```text
QHeizung = HEB
```

Für die linke Seite des Energieflusses wird der vom Nutzer eingegebene Jahresverbrauch vollständig als Energieeintrag dargestellt.

---

## 6.4 Summe Energieeinträge

```text
QEin =
Qintern
+ Qsolar
+ HEB
```

---

# 7. Verluste

## 7.1 Lüftungsverluste

```text
QLüftung = 10 kWh/m³ × V
```

mit:

```text
V = BGF × 3,0 m
```

Der Faktor 10 kWh/m³a ist eine **vereinfachte Jahrespauschale**.

Es wird keine physikalische Lüftungswärmeverlustberechnung über Luftwechselrate, Luftvolumenstrom, Wärmekapazität der Luft oder Wärmerückgewinnung durchgeführt.

---

## 7.2 Anlagenverluste

```text
QAnlage = HEB − HEB × JNG
```

beziehungsweise:

```text
QAnlage = HEB × (1 − JNG)
```

Der verbleibende Anteil:

```text
HEB × JNG
```

wird als nutzbar bereitgestellte Wärme interpretiert.

---

## 7.3 Warmwasser

Nur wenn Warmwasser im Verbrauch enthalten ist:

```text
QWW = Personen × 1.000 kWh/a
```

Sonst:

```text
QWW = 0
```

Der Wert dient der überschlägigen Trennung von Raumwärme und Warmwasser.

---

## 7.4 Rest für Gebäudehülle und Wärmebrücken

Zunächst wird aus der Bilanz der verbleibende Hüllenverlust ermittelt:

```text
QRest =
QEin
− QLüftung
− QAnlage
− QWW
```

Dieser Rest wird anschließend in:

```text
Bauteilverluste
+
Wärmebrücken
```

zerlegt.

---

## 7.5 Bauteilverluste

Das Tool setzt die Wärmebrücken mit 7,5 % der Bauteilverluste an.

Damit:

```text
QRest =
QBauteile
+ 0,075 × QBauteile
```

also:

```text
QRest = 1,075 × QBauteile
```

und daraus:

```text
QBauteile = QRest / 1,075
```

**Wichtig:** QBauteile ist somit eine **Bilanz-Restgröße**.

Es handelt sich nicht um eine Transmissionsverlustberechnung aus:

```text
U-Wert × Fläche × Temperaturdifferenz
```

und auch nicht um einen Energieausweiswert.

---

## 7.6 Wärmebrücken

```text
QWB = QBauteile × 0,075
```

Die 7,5 % sind eine bewusst gewählte Beratungsannahme.

Sie stellen keinen pauschal gültigen normativen Wärmebrückenzuschlag für jedes Gebäude dar.

---

## 7.7 Summe Verluste

```text
QVerlust =
QBauteile
+ QWB
+ QLüftung
+ QAnlage
+ QWW
```

Durch die Berechnung der Bauteilverluste als Restgröße gilt algebraisch:

```text
QVerlust = QEin
```

Die Bilanz ist damit **per Konstruktion geschlossen**.

Die Gleichheit von Einträgen und Verlusten ist daher kein unabhängiger Plausibilitätsnachweis.

---

# 8. Plausibilitätswarnung

Das Tool prüft:

```text
QRest < 0 ?
```

Ist:

```text
QEin
− QLüftung
− QAnlage
− QWW
< 0
```

erscheint die Warnung:

```text
Die gewählten Eingaben ergeben negative Bauteilverluste.
```

Das bedeutet, dass die Kombination aus:

- Verbrauch,
- Jahresnutzungsgrad,
- Warmwasseransatz,
- Gebäudegröße,
- Lüftungsannahme,
- solaren und internen Gewinnen

mit dem vereinfachten Modell nicht plausibel zusammenpasst.

Die Eingaben sollten dann geprüft werden.

---

# 9. Verbrauchsbasierter HWB-Kennwert

## 9.1 HWB Verbrauch

```text
HWBVerbrauch =
(HEB × JNG − QWW) / BGF
```

Einheit:

```text
kWh/(m²·a)
```

Damit wird versucht, aus dem eingegebenen Verbrauch überschlägig einen spezifischen Raumwärme-Nutzenergiekennwert abzuleiten.

**Dieser Wert ist nicht mit dem normativ berechneten HWB eines Energieausweises gleichzusetzen.**

Unterschiede entstehen unter anderem durch:

- Wetter und konkretes Nutzungsjahr,
- tatsächliche Raumtemperaturen,
- Nutzerverhalten,
- tatsächliche beheizte Fläche,
- Ofen- oder Zusatzheizungen,
- Unsicherheit des JNG,
- Warmwasserverbrauch,
- pauschale BGF-Umrechnung,
- nicht normativ ermittelte Gewinne und Verluste.

Der Name „HWB Verbrauch“ ist daher als **verbrauchsbasierte Orientierungsgröße** zu verstehen.

---

## 9.2 Korrigierter HWB-Verbrauch

```text
HWBkorr =
HWBVerbrauch / KRW / KBF
```

Damit wird der Verbrauchskennwert näherungsweise korrigiert auf:

```text
Raumtemperatur: 20 °C
beheizter Anteil: 100 %
```

Die beiden Korrekturen sind Faustformeln des Tools.

Der korrigierte Wert wird dadurch ebenfalls **nicht** zu einem normativen Energieausweis-HWB.

---

# 10. „Energiebedarf“ im Tool

Das Feld:

```text
Energiebedarf
```

zeigt:

```text
QEin =
Qintern
+ Qsolar
+ HEB
```

Es ist daher die **Summe der dargestellten jährlichen Energieeinträge**.

Es handelt sich nicht um einen normativen Energiebedarfskennwert.

Für eine spätere Überarbeitung wäre die Bezeichnung:

```text
Summe Energieeinträge
```

fachlich eindeutiger.

---

# 11. Balkendarstellung

Die Balken visualisieren jeweils den Anteil an:

```text
Summe Einträge
```

beziehungsweise:

```text
Summe Verluste
```

Die Breite ist:

```text
Balkenbreite =
Einzelwert / jeweilige Summe × 100 %
```

Negative Werte werden für die Balkenanzeige auf 0 begrenzt.

Die Zahlenwerte selbst bleiben jedoch sichtbar und können dadurch eine unplausible Eingabekombination offenlegen.

---

# 12. Standardwerte des Tools

Aktuell vorbelegt:

```text
NF                         120 m²
beheizter Anteil            90 %
Fensterflächenanteil        25 % – mittel
Personen                     4
Heizenergieverbrauch    25.000 kWh/a
Warmwasser              inkludiert
JNG                         0,85
Raumtemperatur             22 °C
```

Diese Werte dienen ausschließlich als Startbeispiel.

---

# 13. Rechenbeispiel mit den Standardwerten

Für:

```text
NF = 120 m²
beheizt = 90 %
Fensteranteil = 25 %
Personen = 4
HEB = 25.000 kWh/a
Warmwasser = inkludiert
JNG = 0,85
Raumtemperatur = 22 °C
```

ergibt sich:

```text
BGF = 144 m²
Fensterfläche = 36,0 m²
Glasfläche = 25,2 m²
Gebäudevolumen = 432 m³

KRW = 1,120
KBF = 0,950

Interne Gewinne = 2.838 kWh/a
Solare Gewinne = 4.410 kWh/a
Heizenergie = 25.000 kWh/a

Summe Einträge = 32.248 kWh/a

Lüftung = 4.320 kWh/a
Anlage = 3.750 kWh/a
Warmwasser = 4.000 kWh/a

Rest Hülle + Wärmebrücken = 20.178 kWh/a
Bauteile ≈ 18.771 kWh/a
Wärmebrücken ≈ 1.408 kWh/a

Summe Verluste ≈ 32.248 kWh/a

HWB Verbrauch ≈ 120 kWh/(m²a)
HWB korrigiert ≈ 113 kWh/(m²a)
```

Rundungsdifferenzen in der Anzeige sind möglich.

---

# 14. Was das Tool bewusst nicht berechnet

Nicht enthalten sind insbesondere:

- Bauteilflächen,
- U-Werte,
- tatsächliche Transmissionswärmeverluste,
- geometrische Wärmebrückenzuschläge,
- Luftwechselrate,
- Lüftungsanlage und Wärmerückgewinnung,
- lokale Klimadaten,
- Heizgradtage,
- reale solare Einstrahlung,
- Orientierung und Verschattung,
- g-Werte,
- Gebäudespeichermasse,
- zeitlicher Verlauf von Gewinnen und Verlusten,
- Heizleistung,
- Normaußentemperatur,
- Heizlast,
- tatsächliche Warmwasserprofile,
- Hilfsstrom,
- Verteilverluste im Detail,
- erneuerbare Erzeugung wie PV oder Solarthermie.

---

# 15. Interpretation

Das Tool eignet sich besonders für Aussagen wie:

- „Wo fließt die Energie in dieser vereinfachten Jahresbilanz hin?“
- „Wie groß sind angenommene Lüftungs- oder Anlagenverluste im Verhältnis?“
- „Wie verändert ein anderer JNG die Bilanz?“
- „Wie stark wirken die angenommenen internen und solaren Gewinne?“
- „Welche Größenordnung hat ein aus dem Verbrauch abgeleiteter spezifischer Raumwärmekennwert?“

Nicht zulässig ist die Interpretation:

- „Das sind die tatsächlichen Bauteilverluste.“
- „Das ist der HWB des Energieausweises.“
- „Damit ist die Heizlast berechnet.“
- „Der Wärmebrückenverlust beträgt normativ genau 7,5 %.“
- „Die solaren Gewinne dieses Gebäudes sind exakt so hoch.“

---

# 16. Verhältnis zum Tool „Klima & Heizlast“

Die beiden Werkzeuge erfüllen unterschiedliche Aufgaben.

## Energiefluss im Gebäude

```text
Jahresverbrauch
+ pauschale Gewinne
+ vereinfachte Verluste
→ anschauliche Jahresenergiebilanz
```

## Klima & Heizlast

```text
Standortklima 2012–2025
+ Gebäudeverbrauch / Fläche
→ standortbezogene Heizlastorientierung
```

Die Ergebnisse sollten nicht ohne Weiteres miteinander vermischt werden.

---

# 17. Druckausgabe

Der Ausdruck ist als kompakte Beratungsübersicht konzipiert.

Er enthält:

- Projektdaten,
- Eingaben,
- berechnete Grundwerte,
- Energieeinträge,
- Verluste,
- grafische Energieflussdarstellung,
- verbrauchsbasierte HWB-Abschätzung.

Die Druckausgabe übernimmt dieselben vereinfachten Modellannahmen wie die Bildschirmdarstellung.

---

# 18. Datenquellen und externe Abhängigkeiten

Das Tool verwendet in Version V3 **keine externen Datenbanken oder Live-Schnittstellen**.

Es benötigt daher keinen periodischen Datenimport.

Die Berechnung basiert ausschließlich auf:

- Nutzereingaben,
- fest im JavaScript hinterlegten Modellparametern.

Die Modellparameter müssen bei jeder fachlichen Änderung dokumentiert und versioniert werden.

---

# 19. Modellparameter V3

```text
BGF-Faktor                        1,20
mittlere Gebäudehöhe             3,0 m
Fensterflächenanteil niedrig     15 %
Fensterflächenanteil mittel      25 %
Fensterflächenanteil hoch        40 %
Glasanteil                       70 %
interne Gewinne                  2,7 W/m²
solarer Jahresansatz             175 kWh/m² Glasfläche
Lüftungspauschale                10 kWh/m³a
Wärmebrücken                     7,5 % der Bauteilverluste
Warmwasser                       1.000 kWh/(Person·a)
Raumtemperaturkorrektur          6 % je K bezogen auf 20 °C
Flächenkorrektur                 0,5 % je Prozentpunkt bezogen auf 100 %
```

Alle diese Werte sind Modellparameter des Tools und sollten bei Änderungen bewusst fachlich neu bewertet werden.

---

# 20. Kurzfassung der Formeln

```text
BGF = NF × 1,20

AFenster = BGF × Fensteranteil

AGlas = AFenster × 0,70

V = BGF × 3,0

KRW = 1 + (TRaum − 20) × 0,06

KBF = 1 + (beheizt − 100) × 0,005

Qintern = 2,7 × NF × 8,76

Qsolar = 175 × AFenster × 0,70
       = 175 × AGlas

QEin = Qintern + Qsolar + HEB

QLüftung = 10 × V

QAnlage = HEB × (1 − JNG)

QWW = Personen × 1.000
      falls Warmwasser inkludiert,
      sonst 0

QRest = QEin − QLüftung − QAnlage − QWW

QBauteile = QRest / 1,075

QWB = QBauteile × 0,075

QVerlust =
QBauteile + QWB + QLüftung + QAnlage + QWW

HWBVerbrauch =
(HEB × JNG − QWW) / BGF

HWBkorr =
HWBVerbrauch / KRW / KBF
```

---

# 21. Versionsstatus

Diese Dokumentation beschreibt den aktuellen **V3-Stand** des Tools.

Bei jeder Änderung an:

- Formeln,
- Modellparametern,
- Eingabefeldern,
- Bedeutung der Kennwerte,

soll die Dokumentation gemeinsam mit dem Tool aktualisiert werden.
