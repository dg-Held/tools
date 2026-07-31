
# Klima & Heizlast – Methodik und Datenbasis

**Fortgeschrieben für Toolversion 1.2 · Stand 31.07.2026**

**Dokumentversion:** 1.0  
**Toolversion:** 1.0.0  
**Stand:** 27.07.2026  
**Geltungsbereich:** Tirol  
**Charakter:** Vereinfachte Beratungsschätzung – keine Norm-Heizlastberechnung

---

## 1. Zweck des Dokuments

Dieses Dokument beschreibt die fachliche und technische Grundlage des Webtools
**„Klima & Heizlast“**.

Es dient dazu, auch zu einem späteren Zeitpunkt nachvollziehen zu können:

- welche offiziellen Datenquellen verwendet wurden,
- welcher Datenstand im Tool hinterlegt ist,
- wie Adresse, Katastralgemeinde, Normklima, Geländehöhe und INCA-Raster
  miteinander verknüpft werden,
- wie die Klima- und Heizlastkennzahlen berechnet werden,
- welche Annahmen vom Tool selbst getroffen werden,
- welche Ergebnisse nur als Orientierung zu verstehen sind,
- wie die Datengrundlagen aktualisiert werden.

Das Dokument beschreibt den **tatsächlich implementierten Berechnungsstand von
Version 1.2.0**.

---

# 2. Grundprinzip und Datenfluss

Der normale Datenfluss lautet:

```text
Gebäudeadresse
    │
    ├──► BEV-Stichtagsindex
    │      └── schnelle Vorschläge / Fallback
    │
    └──► TIRIS ogd_basis live
           └── bevorzugte finale Adresse / Koordinate nach Auswahl
                  │
                  ├── Adresscode / Gemeinde / Straße / Hausnummer
                  └── Koordinate

Gemeinsames Projekt / BEV-Fallback
    └── KGNR
             │
             ├──────────────► OIB NAT
             │
             └──────────────► OIB TNAT,13

Koordinate
    │
    ├────────► GeoSphere INCA
    │           └── nächster 1-km-Rasterpunkt
    │               └── stündliche T2M-Klimadaten im aktiven Zeitraum laut Manifest
    │
    └────────► TIRIS DGM
                ├── Geländehöhe Gebäudestandort
                └── Geländehöhe INCA-Rasterpunkt

Klimaanalyse
    │
    ├── Temperaturhäufigkeit
    ├── Temperatur-Dauerlinie
    ├── Kälte-/Hitze-Kennwerte
    └── klimatische Vollbenutzungsstunden

Gebäudeeingaben
    │
    ├── Jahresverbrauch / Nutzwärmefaktor
    ├── Warmwasser / Personen
    ├── beheizte Fläche / Gebäudezustand
    ├── optional HWB / BGF
    └── vorhandene Heizleistung
             │
             ▼
vereinfachte Heizlast- und Leistungsanalyse
```

Die Eingangsdaten und Berechnungen werden bewusst getrennt:

**Offizielle Eingangsdaten**
- Adresse / Koordinaten: TIRIS live bevorzugt, BEV als Vorschlags-/Fallbackquelle
- KGNR: gemeinsamer Projektbestand / BEV, bis die gemeinsame Standortbasis vollständig auf TIRIS umgestellt ist
- Klima: GeoSphere Austria
- NAT / TNAT,13: OIB
- Geländehöhen: Land Tirol / TIRIS

**Eigene Modellannahmen des Tools**
- Heizgrenze 15 °C
- Warmwasserabzug 1.000 kWh pro Person und Jahr
- W/m²-Bandbreiten der Flächenorientierung
- lineare Lastkennlinie zwischen Heizgrenze und NAT
- Schwellwerte für UI-Hinweise zur Höhendifferenz und Datenqualität
- 90-%-Stundendeckung als Beratungskennzahl

Diese eigenen Annahmen sind **keine amtlichen oder normativen Werte**, sofern
nicht ausdrücklich anders angegeben.

---

# 3. Datenquellen

## 3.1 Österreichisches Adressregister – BEV

**Herausgeber:** Bundesamt für Eich- und Vermessungswesen (BEV)  
**Produkt:** Adresse Relationale Tabellen – Stichtagsdaten  
**verwendeter Stichtag:** 01.04.2026  
**Lizenz:** Creative Commons Namensnennung 4.0 International  
**Quellenhinweis im Datenpaket:**  
`© Österreichisches Adressregister, Stichtagsdaten vom 01.04.2026`

### Offizielle Links

- Produkt / Download:  
  https://www.bev.gv.at/Services/Downloads/Produktbezogene-Downloads/Unentgeltliche-Produkte/Adressregister.html
- Produktinformation:  
  https://www.bev.gv.at/Services/Produkte/Adressregister/Oesterreichisches-Adressregister.html
- Formatbeschreibungen:  
  https://www.bev.gv.at/Services/Downloads/Produktbezogene-Downloads/Formatbeschreibungen-Infos.html
- Lizenz:  
  https://creativecommons.org/licenses/by/4.0/

Das BEV beschreibt das Adressregister als amtlichen offiziellen Adressbestand
Österreichs. Die unentgeltlichen Stichtagsdaten werden zweimal jährlich mit
Stichtag 1. April und 1. Oktober erzeugt und etwa 14 Tage später veröffentlicht.

### Im Tool verwendete Tabellen

| Tabelle | Verwendung |
|---|---|
| `ADRESSE.csv` | Adresscode, PLZ, GKZ, OKZ, SKZ, Hausnummer, Zugangskoordinate |
| `GEMEINDE.csv` | GKZ → Gemeindename |
| `STRASSE.csv` | SKZ → Straßenname und Zustellort |
| `ORTSCHAFT.csv` | OKZ → Ortschaftsname |
| `ADRESSE_GST.csv` | Adresscode → Katastralgemeinde / KGNR |
| `GEBAEUDE.csv` | optionale Gebäudekoordinate |

### Tiroler Datenbestand Version 1.0

```text
Adressen:                         207.322
Katastralgemeinden:                    350
Adressen mit KG-Zuordnung:        207.322
Adressen mit mehreren KG:             115
Gebäudekoordinate verwendet:      193.902
Zugangskoordinate verwendet:       13.420
```

### Adresssuche und Auswahl der Standortkoordinate

Seit Version 1.2 werden **schnelle Vorschläge** und **amtlicher Live-Abgleich** getrennt:

1. Während der Eingabe liefert der lokale BEV-Stichtagsbestand die Vorschlagsliste. Dadurch bleibt die Suche schnell und funktioniert auch ohne Netzwerkverzögerung.
2. Nach Auswahl eines Vorschlags wird die Adresse bevorzugt über den gemeinsamen `ADRCD` live gegen TIRIS `ogd_basis` geprüft.
3. Ist kein eindeutiger ADRCD-Treffer vorhanden, erfolgt ein zweiter Live-Abgleich über PLZ und Hausnummer mit anschließender Plausibilisierung von Straße/Gemeinde.
4. Nur wenn TIRIS nicht erreichbar ist oder kein eindeutiger Treffer gefunden wird, bleibt die BEV-Stichtagsadresse als gekennzeichneter Fallback bestehen.

Damit ist der BEV-Bestand **Vorschlags- und Rückfallquelle**, während die tatsächlich ausgewählte Adresse nach Möglichkeit aus TIRIS live stammt. Unterschiedliche Schreibweisen zwischen BEV und TIRIS – etwa Orts-/Gemeindezusätze – werden dadurch nicht als unterschiedliche Gebäude interpretiert, sofern der Adresscode übereinstimmt.

Für die BEV-Fallbackkoordinate gilt weiterhin die technische Regel: plausible Gebäudekoordinate bevorzugen, ansonsten Zugangskoordinate. Die bisherige 100-m-Plausibilitätsgrenze ist keine BEV-Vorgabe, sondern eine konservative Regel des Tools.

### Mehrere Katastralgemeinden

Sind einer Adresse mehrere KGNR zugeordnet, wird **keine KG automatisch
willkürlich gewählt**. Das Tool zeigt die Kandidaten mit NAT, TNAT,13 und
ELEVmin an und verlangt eine Auswahl.

---

## 3.2 GeoSphere Austria – INCA-v1

**Datensatz:** INCA-v1 (1 h), 1 km  
**Parameter:** `T2M` – Lufttemperatur in 2 m Höhe  
**verwendeter Zeitraum:** 01.01.2012 bis 31.12.2025  
**zeitliche Auflösung:** 1 Stunde  
**räumliche Auflösung:** 1 km × 1 km  
**Zeitzone:** UTC  
**Rasterprojektion:** MGI / Austria Lambert, EPSG:31287  
**Lizenz:** Creative Commons Namensnennung 4.0 International

### Offizielle Links

- Datensatz:  
  https://data.hub.geosphere.at/de/dataset/inca-v1-1h-1km
- DOI:  
  https://doi.org/10.60669/6akt-5p05
- API-Dokumentation:  
  https://dataset.api.hub.geosphere.at/v1/docs/
- API-Endpunkt des Tools:  
  https://dataset.api.hub.geosphere.at/v1/timeseries/historical/inca-v1-1h-1km
- Massendownload:  
  https://data.hub.geosphere.at/dataset/inca-v1-1h-1km/resource/inca-v1-1h-1km-filearchiv

Die Timeseries-API liefert für eine in EPSG:4326 angegebene Koordinate den
nächstgelegenen Rasterpunkt.

### Laufzeit-Abruf und vorberechnete Klimaprofile

Der Live-Abruf bleibt als Rückfallweg erhalten. Für die reguläre Nutzung wird die INCA-Auswertung jedoch schrittweise auf **jahresweise vorberechnete Pakete** umgestellt.

Die fachliche Berechnung bleibt unverändert: NAT-abhängige Kennzahlen werden weiterhin für die konkrete Katastralgemeinde im Browser berechnet. Die Jahrespakete enthalten nur jene standortunabhängigen INCA-Kennwerte und Dauerlinien-Stützstellen, die aus den Stundenwerten abgeleitet werden können.

### Jahresweise Paketstruktur ab Version 1.2

```text
data/climate-precomputed/
  manifest.json
  yearly/
    index.json
    2025.json
    2025/<tile>.json
    2026.json
    2026/<tile>.json
    ...
```

Ein Kalenderjahr ist damit ein eigenständiges Paket. Die Kachelung bleibt bewusst erhalten: Eine einzige große JSON-Datei pro Jahr würde im Browser für einen einzelnen Standort unnötig die Daten aller Tiroler Rasterpunkte übertragen.

Jedes Jahresprofil enthält:

- die vollständige Zeile nach `annual_schema`,
- Temperaturhäufigkeiten,
- NAT-Schwellenzählungen,
- Stützstellen der Jahres-Dauerlinie,
- sechs Grenzwerte des 31. Dezember 18–23 UTC für die korrekte Tropennacht zum 1. Jänner des Folgejahres.

Sobald die einmalige Migration des bisherigen Basiszeitraums vollständig ist, wird der aktive Zeitraum ausschließlich aus `manifest.json` ermittelt. Ein lückenlos neu hinzugefügtes Jahr erweitert Zeitraum, Diagramme und Datenstand automatisch; `START_YEAR` / `END_YEAR` müssen dann nicht mehr manuell geändert werden.

Bis diese Migration vollständig abgeschlossen ist, bleibt der bisherige Precompute-/Live-Betrieb unverändert aktiv. Es gibt dadurch keinen Zwischenzustand mit unvollständigem Klimazeitraum.

---

## 3.3 OIB – Normaußentemperatur NAT

**Herausgeber:** Österreichisches Institut für Bautechnik (OIB)  
**Dokument:** `Normaussentemperaturen - OIB-Richtlinie 6`  
**Dokumentstand:** 16.06.2015  
**Tirol:** 350 Katastralgemeinden

### Offizielle Links

- aktuelle Seite OIB-Richtlinie 6:2025:  
  https://www.oib.or.at/richtlinien/oib-richtlinien-2025/oib-richtlinie-6/
- NAT-Datei:  
  https://www.oib.or.at/wp-content/uploads/oib-rl_6_normaussentemperaturen.pdf

Die aktuelle OIB-Seite zur Richtlinie 6 Ausgabe 2025 stellt die Datei
„Normaussentemperaturen“ weiterhin bereit. Das verlinkte NAT-Dokument selbst
trägt den Stand 16.06.2015.

### Verwendete Felder

- KGNR
- Name der Katastralgemeinde
- `ELEVMIN`
- `ELEVMAX`
- NAT / `θELEVMIN`
- Klimaregion

Die NAT ist der veröffentlichte Wert **am ELEVMIN der Katastralgemeinde**.

### Höhenkorrektur

Das Tool nimmt **keine automatische Höhenkorrektur der NAT** vor.

Der Grund ist bewusst fachlich konservativ: In alpinen Lagen ist eine
pauschale lineare Temperaturkorrektur nach Höhe wegen lokaler Topografie,
Tal-/Hanglage und Inversionen nicht zuverlässig genug.

Stattdessen werden transparent verglichen:

- Gebäudehöhe,
- INCA-Rasterhöhe,
- OIB-ELEVmin.

---

## 3.4 OIB – TNAT,13

**Herausgeber:** Österreichisches Institut für Bautechnik (OIB)  
**Dokument:** `OIB-330.6-055/26`  
**Stand:** April 2026  
**Tirol:** 350 Katastralgemeinden

### Offizielle Links

- aktuelle Seite OIB-Richtlinie 6:2025:  
  https://www.oib.or.at/richtlinien/oib-richtlinien-2025/oib-richtlinie-6/
- TNAT,13-Datei:  
  https://www.oib.or.at/wp-content/uploads/tnat13-aussentemperaturen-mit-einer-durchschnittlichen-ueberschreitungshaeufigkeit-von-13-tagen.pdf

### Definition

TNAT,13 ist im OIB-Dokument definiert als:

> Außenlufttemperatur mit einer Überschreitungshäufigkeit von 130 Tagen in
> 10 Jahren.

Der veröffentlichte Wert gilt ebenfalls am `ELEVmin` der jeweiligen
Katastralgemeinde.

### Verwendung im Tool

TNAT,13 dient als **sommerliche Standortreferenz** und wird:

- im Standortblock angezeigt,
- im Temperatur-Häufigkeitsdiagramm markiert,
- im Ausdruck dokumentiert.

**TNAT,13 beeinflusst die Heizlastberechnung nicht.**

---

## 3.5 Land Tirol / TIRIS – Geländehöhen

**Quelle:** Land Tirol, TIRIS / Gelände Tirol  
**verwendetes Modell:** DGM 5 m  
**REST-Service:** `Service_Public/terrain/MapServer`  
**Rasterlayer:** `Image_DGM_5m_M28`, Layer 4  
**Service-Koordinatensystem:** EPSG:31254

### Offizielle Links

- Laserscandaten / DGM:  
  https://www.tirol.gv.at/sicherheit/geoinformation/geodaten-tiris/laserscandaten
- TIRIS Geodatendienste:  
  https://www.tirol.gv.at/statistik-budget/tiris/tiris-geodatendienste/
- REST-Service:  
  https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/terrain/MapServer
- OGD-Nutzungsbedingungen:  
  https://www.tirol.gv.at/data/nutzungsbedingungen/

Das DGM beschreibt das Gelände ohne aufstehende Objekte wie Gebäude oder
Vegetation.

### Lizenz / Quellenangabe

Open Government Data des Landes Tirol steht grundsätzlich unter CC BY 4.0
mit ergänzenden Nutzungsbedingungen.

Vorgegebene Namensnennung:

`Datenquelle: Land Tirol - data.tirol.gv.at`

### Verwendung

Für jeden Standort werden – sofern der Dienst erreichbar ist – zwei Höhen
abgefragt:

1. Geländehöhe des Gebäudestandorts
2. Geländehöhe des tatsächlich verwendeten INCA-Rasterpunkts

Daraus entsteht:

```text
ΔH Gebäude/Raster = HGebäude − HRaster
```

Zusätzlich:

```text
ΔH Gebäude/OIB = HGebäude − ELEVmin
```

Es erfolgt daraus **keine automatische Temperaturkorrektur**.

### Hinweisstufen zur Gebäude-/Rasterhöhe

Diese Stufen sind **eigene UI-Regeln des Tools**, keine amtliche Klassifikation:

| absolute Höhendifferenz | Anzeige |
|---:|---|
| < 50 m | Gute Höhenübereinstimmung |
| 50–150 m | Höhenunterschied beachten |
| > 150 m | Deutlicher Höhenunterschied |

---

# 4. Klimaanalyse

## 4.1 Gültige Jahresdaten

Ein Jahr wird nur ausgewertet, wenn mindestens **8.000 gültige Stundenwerte**
vorliegen.

Erwartete Stunden:

```text
Normaljahr: 8.760 h
Schaltjahr: 8.784 h
```

Fehlende Einzelwerte werden in der Datenqualität ausgewiesen.

---

## 4.2 Heizgrenze

Die gesamte Heizklimaauswertung verwendet:

```text
THeizgrenze = 15 °C
```

Dies ist eine **Modellannahme des Tools**.

Eine Stunde zählt als „Stunde mit Heizbedarf“, wenn:

```text
Te < 15 °C
```

Die angezeigte Kennzahl ist der arithmetische Mittelwert der jährlichen
Stundenzahlen des jeweils aktiven Mehrjahreszeitraums.

---

## 4.3 Relative Heizlast und klimatische Vollbenutzungsstunden

Für jede gültige Stunde eines Jahres wird eine lineare relative Last berechnet:

```text
r(h) = max(0 ; (15 − Te(h)) / (15 − NAT))
```

mit:

- `Te(h)` = INCA-Außentemperatur der Stunde
- `NAT` = OIB-Normaußentemperatur der konkreten KG

Die relative Last wird **nicht bei 1 begrenzt**. Ist eine Stunde kälter als
NAT, kann `r(h) > 1` werden.

Die jährlichen klimatischen Vollbenutzungsstunden sind:

```text
hVL,Jahr = Σ r(h)
```

Der im Tool verwendete Standortwert ist:

```text
hVL = Mittelwert(hVL,2012 … hVL,2025)
```

Interpretation:

`hVL` ist die Zahl äquivalenter Stunden bei der verbrauchsbasierten Heizlast
am NAT-Punkt. Es handelt sich **nicht** um reale Brennerlaufstunden.

---

## 4.4 Stunden unter Temperaturgrenzen

Je Jahr werden gezählt:

```text
Te < 0 °C
Te < −5 °C
Te < −10 °C
Te ≤ NAT
Te < 15 °C
```

Die Hauptkennzahlen sind die Mittelwerte über alle Jahre des jeweils aktiven Mehrjahreszeitraums.

`Stunden ≤ NAT` bedeutet nicht, dass ein vorhandener Wärmeerzeuger mit 100 %
läuft. Es bedeutet, dass die vereinfachte lineare **Gebäudelast** bei diesen
Stunden mindestens der definierten Last am NAT-Punkt entspricht.

---

# 5. Temperatur-Häufigkeitsdiagramm

## 5.1 Temperaturklassen

Die Stundenwerte werden in 1-K-Temperaturklassen einsortiert.

Beispiel:

```text
Klasse 0 °C → ungefähr −0,5 bis +0,5 °C
```

Die Klassen reichen intern von:

```text
−35 °C bis +40 °C
```

## 5.2 Normalisierung

Schaltjahre und Jahre mit wenigen fehlenden Einzelwerten werden für die
Darstellung auf **8.760 h** normalisiert:

```text
Skalierungsfaktor = 8.760 / Anzahl gültiger Stunden
```

Dadurch sind die 14 Jahreskurven direkt vergleichbar.

## 5.3 Medianlinie

Für jede Temperaturklasse wird aus den 14 Jahreswerten der Median gebildet.

Die kräftige Linie zeigt daher:

```text
Median der Stundenhäufigkeit über den aktiven Mehrjahreszeitraum
```

Die Kärtchen oberhalb des Diagramms sind dagegen überwiegend
**arithmetische Mittelwerte der Jahreskennzahlen**.

Medianlinie und Kärtchen sind daher bewusst zwei verschiedene Aggregationen.

---

# 6. Temperatur-Dauerlinie

Für jedes Jahr:

1. gültige Stundenwerte aufsteigend sortieren,
2. auf 8.760 Rangpositionen interpolieren.

Danach wird für jede Rangposition über alle Jahre berechnet:

```text
P10
Median
P90
```

Für die Heizleistungs-Dauerlinie wird die **mediane Temperatur-Dauerlinie**
verwendet.

Diese Linie beschreibt einen klimatologisch typischen Verlauf der sortierten
Stundentemperaturen, nicht den zeitlichen Verlauf eines konkreten Jahres.

---

# 7. Kälte- und Hitze-Kennzahlen

## 7.1 Kälteste Einzelstunde

```text
Minimum aller gültigen stündlichen T2M-Werte des aktiven Mehrjahreszeitraums
```

## 7.2 Kältestes 24-h-Mittel

Über die Stundenreihe wird ein gleitendes Fenster von 24 gültigen Werten
gebildet:

```text
T24 = Mittelwert von 24 aufeinanderfolgenden Stundenwerten
```

Ausgegeben wird das Minimum.

Technische Annahme: Die GeoSphere-Zeitreihe wird als kontinuierliche
Stundenfolge geliefert. Eine zusätzlich davon unabhängige Prüfung auf
ausgelassene Zeitstempel erfolgt in Version 1.0 nicht.

## 7.3 Hitzetage

Ein Tag wird ausgewertet, wenn mindestens 20 gültige stündliche Werte
vorliegen.

```text
Hitzetag:        Tagesmaximum ≥ 30 °C
Extremer Hitzetag: Tagesmaximum ≥ 35 °C
```

Es handelt sich um Ableitungen aus stündlichen Rasterwerten und nicht um
offizielle tägliche Stationsstatistiken.

## 7.4 Tropennächte

Technische Nachtdefinition des Tools:

```text
18–23 UTC des Vortags
+
00–06 UTC des Folgetags
=
13 Stundenwerte
```

Nur Nächte mit allen 13 gültigen Werten werden ausgewertet.

```text
Tropennacht ⇔ Minimum dieser 13 Stunden ≥ 20 °C
```

Die Nacht wird dem Kalendertag des Morgens zugeordnet.

Diese Auswertung dient als anschauliche Klimakennzahl. Sie ist keine
stationsbasierte offizielle Klimastatistik.

---

# 8. Datenqualität

Die Datenqualität wird aus den erwarteten und fehlenden Stundenwerten des aktiven Mehrjahreszeitraums abgeleitet.

Eigene UI-Klassifikation:

| fehlende Werte | Bewertung |
|---:|---|
| ≤ 0,1 % | Datenqualität sehr gut |
| > 0,1 % bis 1,0 % | Geringe Datenlücken |
| > 1,0 % | Datenlücken beachten |

Diese Schwellen sind keine GeoSphere-Qualitätsklassen, sondern eine
Darstellungsregel des Tools.

---

# 9. Verbrauchsbasierte Heizlastabschätzung

## 9.1 Nutzwärme gesamt

```text
QNutz,gesamt = Jahresverbrauch × Nutzwärmefaktor
```

Der Faktor wird passend zur Art des eingegebenen Verbrauchs gewählt.

Typische Interpretation:

- Heizkessel: Jahresnutzungsgrad `JNG`
- Wärmepumpe bei Stromverbrauch: Jahresarbeitszahl `JAZ`
- Direktheizung bzw. bereits als Nutzwärme interpretierter Wert: ungefähr 1

Das Tool erzwingt keinen systemspezifischen Faktor.

## 9.2 Warmwasserabzug

Ist Warmwasser im Jahresverbrauch enthalten:

```text
QWW = Personen × 1.000 kWh/(Person·a)
```

Die 1.000 kWh pro Person und Jahr sind eine **vereinfachte Beratungsannahme
des Tools**.

## 9.3 Raumwärme

```text
QRaum,roh = QNutz,gesamt − QWW

QRaum = max(QRaum,roh ; 0)
```

Würde der Warmwasserabzug größer als die Nutzwärme, erzeugt das Tool einen
Prüfhinweis.

## 9.4 Heizlast aus Verbrauch

```text
PVerbrauch = QRaum / hVL
```

Einheiten:

```text
kWh/a ÷ h/a = kW
```

Diese Leistung ist die aus Jahresenergie und Standortklima abgeleitete
vereinfachte Leistung am NAT-Punkt.

---

# 10. Flächenorientierung

Die Flächenmethode ist eine **unabhängige grobe Plausibilitätskontrolle**.

```text
PFläche = ABeheizt × q / 1.000
```

mit `q` in W/m².

Hinterlegte Bandbreiten Version 1.0:

| Gebäudezustand | Bandbreite |
|---|---:|
| Unsanierter Altbau | 120–160 W/m² |
| Teilsanierter Bestand | 80–120 W/m² |
| Sanierter Bestand | 50–80 W/m² |
| Neuerer Standard / Neubau | 40–70 W/m² |

**Diese Bandbreiten sind Beratungsfaustformeln des Tools und ausdrücklich
keine Normwerte.**

Der Mittelwert der gewählten Bandbreite wird nur dann als Referenzlast für den
Heizungsvergleich verwendet, wenn keine positive verbrauchsbasierte Heizlast
vorliegt.

---

# 11. Optionaler HWB-Vergleich

Bei Eingabe von HWB und Bruttogrundfläche:

```text
QHWB = HWB × BGF
```

und:

```text
PHWB = QHWB / hVL
```

Der HWB-Vergleich ist ein zusätzlicher unabhängiger Orientierungswert.

Er ersetzt weder die Verbrauchsmethode noch eine normgerechte
Heizlastberechnung.

---

# 12. Referenzlast für den Heizungsvergleich

Priorität:

```text
1. positive verbrauchsbasierte Heizlast
2. sonst Mittelwert der Flächenbandbreite
```

Damit:

```text
PRef =
    PVerbrauch, wenn PVerbrauch > 0
    sonst (PFläche,min + PFläche,max) / 2
```

---

# 13. Vergleich mit der vorhandenen Heizung

## 13.1 Leistungsverhältnis

```text
f = Pinstalliert,max / PRef
```

Das Tool bewertet diesen Faktor nicht automatisch als „richtig“ oder
„überdimensioniert“.

## 13.2 Rechnerische Reserve

Nur in den technischen Berechnungsdetails:

```text
Reserve = (f − 1) × 100 %
```

## 13.3 Auslastung bei NAT

```text
AuslastungNAT =
PRef / Pinstalliert,max × 100 %
```

Die Kennzahl bezieht sich auf die vereinfachte Gebäudelast, nicht auf reale
Brenner- oder Verdichterauslastung.

## 13.4 Theoretische Volllasttemperatur der vorhandenen Anlage

Aus der linearen Gebäudekennlinie:

```text
TVoll =
15 − f × (15 − NAT)
```

Interpretation:

Bei dieser theoretischen Außentemperatur würde die vereinfachte Gebäudelast
der eingetragenen installierten Maximalleistung entsprechen.

Eine sehr tiefe Temperatur ist ein Hinweis auf hohe Leistungsreserve, aber
**keine automatische Überdimensionierungsdiagnose**.

---

# 14. Heizleistungs-Dauerlinie

Für jede Rangposition der medianen Temperatur-Dauerlinie:

```text
r = max(0 ; (15 − TMedian) / (15 − NAT))

PBedarf = PRef × r
```

Die Last wird nicht bei `PRef` gedeckelt. Bei Temperaturen unter NAT kann der
rechnerische Bedarf über `PRef` steigen.

Das Diagramm vergleicht:

- vereinfachten Gebäudeleistungsbedarf,
- installierte Maximalleistung,
- optionale Mindestleistung,
- Leistung für 90 % der Heizstunden.

---

# 15. Mindestleistung

Bei eingetragener Mindestleistung:

```text
Stunden unter Mindestleistung =
Anzahl der Stunden mit

0 < PBedarf < Pinstalliert,min
```

Anteil:

```text
Anteil =
Stunden unter Mindestleistung
/
Stunden mit Heizbedarf
× 100 %
```

Außerdem:

```text
TMindest =
15 − (Pmin / PRef) × (15 − NAT)
```

`TMindest` ist die vereinfachte Außentemperatur, oberhalb derer die
Gebäudelast unter die eingetragene Mindestleistung fällt.

Wichtig:

**Stunden unter Mindestleistung sind nicht gleich Brennerstarts oder
Taktzyklen.**

Regelung, Speicher, Gebäudemasse, Hydraulik und tatsächlicher Betrieb werden
nicht simuliert.

---

# 16. Leistung für 90 % der Heizstunden

Aus der Heizleistungs-Dauerlinie werden nur positive Leistungswerte
(Heizstunden) verwendet und aufsteigend sortiert.

```text
P90h = 90%-Quantil der positiven Heizleistungen
```

Bedeutung:

Während 90 % der Heizstunden ist der rechnerische Bedarf:

```text
PBedarf ≤ P90h
```

Die kältesten 10 % der Heizstunden liegen darüber.

Diese Kennzahl ist:

- eine **Stundendeckung**,
- keine Energiedeckung,
- keine automatische Dimensionierungsempfehlung,
- keine Empfehlung zur monovalenten Auslegung.

Sie ist insbesondere als Beratungsgröße für bivalente Konzepte gedacht.

---

# 17. Ausdruck / Kundenausgabe

Der Ausdruck wurde bewusst auf zwei Seiten beschränkt.

## Seite 1 – Klima

Enthält:

- Standort und Ausdruckdatum
- kompakten Standort-/Höhenbezug
- zentrale Klimakennzahlen
- Stundenhäufigkeit der Außentemperatur
- Einordnung von Mittelwert / Median
- NAT, Heizgrenze und TNAT,13
- kompakte Datenquellen

Nicht enthalten:

- vollständige Jahreswertetabelle
- ausführliche Datenqualitätsdetails
- technische Standortkarten

## Seite 2 – Heizlast und Heizung

Enthält:

- Verbrauchsmethode
- Flächenvergleich
- vorhandene Heizleistung
- optional HWB-Vergleich
- zentrale Leistungskennzahlen
- Heizleistungs-Dauerlinie
- kurze Interpretation

Nicht enthalten:

- vollständige Berechnungsgrundlagen
- technische Zwischenergebnisse

Diese bleiben auf der Webseite aufklappbar und sind in diesem Dokument
vollständig beschrieben.

---

# 18. Grenzen und Nicht-Ziele

Das Tool ist ausdrücklich **keine Norm-Heizlastberechnung**.

Nicht stundengenau oder nicht vollständig abgebildet werden insbesondere:

- Transmissionsverluste einzelner Bauteile
- Lüftungs- und Infiltrationsverluste
- Wind- und Expositionseinfluss
- interne und solare Gewinne
- Gebäudespeichermasse
- Aufheizleistung nach Absenkbetrieb
- Warmwasser-Spitzenlast
- Pufferspeicher
- hydraulische Einflüsse
- Heizflächen / erforderliche Vorlauftemperaturen
- Regelung
- tatsächliche Taktzyklen
- Ofen- oder Zusatzheizungen
- unterschiedliche Raumtemperaturen / Nutzungszonen
- individuelle Nutzergewohnheiten
- lokale Mikroklimaeffekte unterhalb der 1-km-INCA-Auflösung

Der jeweils in `manifest.json` aktive, lückenlose Mehrjahreszeitraum ist eine bewusst gewählte aktuelle Vergleichsperiode. Er ist **keine 30-jährige klimatologische Normalperiode**.

---

# 19. Transparenz bei Höhenunterschieden

Das Tool korrigiert INCA-Temperaturen oder NAT **nicht automatisch** nach
Höhenlage.

Stattdessen liefert es:

```text
Gebäudehöhe
INCA-Rasterhöhe
Δ Gebäude/Raster
OIB-ELEVmin
Δ Gebäude/ELEVmin
```

Dadurch bleibt sichtbar, wann der 1-km-Rasterpunkt oder die OIB-Referenzhöhe
vom konkreten Gebäudestandort abweichen.

Gerade im alpinen Raum ist diese transparente Darstellung einer pauschalen
Temperaturgradienten-Korrektur vorzuziehen.

---

# 20. Aktualisierung der Daten

## BEV

Empfohlen: zweimal jährlich prüfen.

Stichtage:

```text
1. April
1. Oktober
```

Nach neuem Stichtagsdownload den Tiroler Adressindex neu erzeugen und
`datenstand.json` aktualisieren.

## GeoSphere INCA

Empfohlen: einmal jährlich nach Abschluss eines vollständigen Kalenderjahres.

Initialer Basiszeitraum ist 2012–2025. Nach der einmaligen Migration auf Jahrespakete wird ein neues Jahr nur dann aktiv, wenn es vollständig vorliegt und lückenlos an den bisherigen Zeitraum anschließt. Die BAT erzeugt ausschließlich das neue Jahrespaket; alte Jahrespakete werden nicht neu berechnet.

## OIB NAT

Bei neuer OIB-Richtlinie bzw. Änderung der auf der OIB-Seite bereitgestellten
NAT-Datei prüfen.

Wichtig: Nicht allein aus dem Titel „OIB-Richtlinie 6 2025“ auf einen neuen
NAT-Datenstand schließen; der aktuell verlinkte NAT-Datensatz trägt selbst den
Stand 16.06.2015.

## OIB TNAT,13

Bei neuer OIB-Datei oder neuer Richtlinienausgabe prüfen.

Aktueller Toolstand:

```text
OIB-330.6-055/26
April 2026
```

## TIRIS

Der Höhenservice wird live verwendet.

Mindestens bei Wartungsupdates prüfen:

- REST-Endpunkt erreichbar?
- Layer 4 `Image_DGM_5m_M28` weiterhin vorhanden?
- Antwortformat unverändert?
- Lizenz-/Quellenangabe unverändert?

---

# 21. Quellenangaben für Veröffentlichung

Empfohlene kompakte Referenz im Tool bzw. Ausdruck:

```text
Adresse: BEV-Stichtagsbestand für Vorschläge/Fallback; ausgewählte Adresse bevorzugt TIRIS live über ogd_basis
Klima: GeoSphere Austria, INCA-v1, T2M, aktiver Zeitraum laut manifest.json, CC BY 4.0
Normklima: OIB NAT und TNAT,13
Höhe: Datenquelle Land Tirol - data.tirol.gv.at, TIRIS DGM
```

Für BEV-Daten zusätzlich:

```text
© Österreichisches Adressregister, Stichtagsdaten vom 01.04.2026
```

Für TIRIS-OGD:

```text
Datenquelle: Land Tirol - data.tirol.gv.at
```

---

# 22. Maschinenlesbarer Datenstand

Die Datei:

```text
data/datenstand.json
```

ist die zentrale maschinenlesbare Referenz für:

- Toolversion
- Datenstände
- Quellenlinks
- Lizenzen
- Attribution
- Aktualisierungshinweise

Bei Datenupdates soll diese Datei gemeinsam mit den Datensätzen geändert
werden.

---

# 23. Kurzfassung der wichtigsten Formeln

```text
Qnutz,gesamt = Jahresverbrauch × Faktor

QWW = Personen × 1.000 kWh/a
      (nur wenn Warmwasser enthalten)

Qraum = max(Qnutz,gesamt − QWW ; 0)

r(h) = max(0 ; (15 − Te(h)) / (15 − NAT))

hVL,Jahr = Σ r(h)

hVL = Mittelwert der Jahreswerte des aktiven Mehrjahreszeitraums

PVerbrauch = Qraum / hVL

PFläche,min/max = A × qmin/max / 1.000

QHWB = HWB × BGF

PHWB = QHWB / hVL

PRef = PVerbrauch, wenn > 0,
       sonst Mittelwert der Flächenbandbreite

f = Pinstalliert,max / PRef

AuslastungNAT = PRef / Pinstalliert,max × 100 %

TVoll = 15 − f × (15 − NAT)

PBedarf(h) =
PRef × max(0 ; (15 − TMedian(h)) / (15 − NAT))

P90h = 90%-Quantil der positiven PBedarf-Werte

TMindest =
15 − (Pmin / PRef) × (15 − NAT)
```

---

# 24. Versionsstatus

**Version 1.2.0** verändert die fachliche Klima- und Heizlastmethodik nicht. Neu sind die gemeinsame Projekt-/Standortarchitektur, der hybride Adressablauf und die vorbereitete jahresweise INCA-Paketierung.

Bis zur vollständigen Basismigration bleibt die bisherige vorberechnete/Live-Logik aktiv. Danach werden lückenlose Jahrespakete verwendet; GeoSphere Live bleibt Rückfallweg. Damit ist die jährliche Datenpflege von der fachlichen Berechnung getrennt.
