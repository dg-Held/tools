# Energiefluss im Gebäude – Formelblatt V3

## Eingaben

```text
NF
beheizter Anteil [%]
Fensteranteil 15 / 25 / 40 %
Personen
HEB [kWh/a]
Warmwasser inkl./exkl.
JNG
Raumtemperatur
```

## Grunddaten

```text
BGF = NF × 1,20
AFenster = BGF × Fensteranteil
AGlas = AFenster × 0,70
V = BGF × 3,0
```

## Korrekturen

```text
KRW = 1 + (TRaum − 20) × 0,06
KBF = 1 + (beheizt − 100) × 0,005
```

## Einträge

```text
Qintern = 2,7 × NF × 8,76
Qsolar = 175 × AFenster × 0,70
QEin = Qintern + Qsolar + HEB
```

## Verluste

```text
QLüftung = 10 × V
QAnlage = HEB × (1 − JNG)
QWW = Personen × 1.000, falls inkludiert
QRest = QEin − QLüftung − QAnlage − QWW
QBauteile = QRest / 1,075
QWB = QBauteile × 0,075
```

## Verbrauchskennwert

```text
HWBVerbrauch = (HEB × JNG − QWW) / BGF
HWBkorr = HWBVerbrauch / KRW / KBF
```

**Nicht normativ:** Die Berechnung ist eine überschlägige Beratungs- und Visualisierungshilfe.
