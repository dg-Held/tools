# Methodik aller Tools

**Stand:** 06.08.2026

## Standortpass

### Geometrie

Amtliche Ausgangswerte sind Dachprojektion (`Shape__Area`), Umfang (`Shape__Length`) sowie Median-/Maximalhöhe des gewählten TIRIS-Gebäudes. Daraus entsteht eine transparente Beratungskette:

```text
Geschoße_ref = round(Medianhöhe / 3,2 m)
BGF_ref = Dachprojektion × Geschoße_ref
NFL_ref = BGF_ref × 0,75
```

Das Höhenmodul von 3,2 m ist eine feste, bewusst gerundete Toolannahme. In OIB-Energiekennzahlen wurde für bestimmte Bezugsgrößen mit einer Geschoßhöhe von 3,0 m gerechnet; der Toolzuschlag von 0,2 m berücksichtigt überschlägig Deckenaufbau und Dachanteile. 3,2 m ist weder ein Messwert noch eine allgemein normativ festgelegte Geschoßhöhe.

Der Faktor 0,75 ist eine einfache, eher großzügige Beratungsannahme und kein allgemeiner Normwert. Eine TU-Wien-Auswertung von 337 Ein- und Zweifamilienhäusern ergab einen Mittelwert von 67,56 %, einen Median von 67,41 % und für die mittleren 50 % der Objekte 63,39–71,60 % NUF/BGF. Für den Standortpass bleibt 0,75 als leicht nachvollziehbarer Standard fest hinterlegt; vorhandene Plan-, Energieausweis- oder Projektwerte haben immer Vorrang.

Priorität der verwendeten Flächen:

1. bekannte manuelle BGF,
2. bekannte manuelle NFL mit `BGF = NFL / 0,75`,
3. automatische BGF aus Dachprojektion und Geschoßzahl.

Geschoßzahl und NFL sind die wichtigsten Prüfeingaben. Aus `Grundfläche_verwendet = BGF / Geschoße` werden OGD, unterster Abschluss und Gebäudevolumen nachgeführt. Die Außenwand wird bei geänderter Grundfläche über die Quadratwurzel des Flächenverhältnisses skaliert; dadurch folgt der Umfang bei ähnlicher Gebäudeform plausibler als bei linearer Skalierung.

```text
Außenwand = TIRIS-Umfang × √(Grundfläche_verwendet / Dachprojektion) × Medianhöhe
Fenster = Außenwand × Fensteranteil
OGD = Kellerdecke = Grundfläche_verwendet
Dachschräge = Grundfläche_verwendet / cos(Dachneigung)
Gebäudevolumen = Grundfläche_verwendet × Medianhöhe
```

Der Fensteranteil ist als Beratungsregler von 10 bis 50 % voreingestellt auf 25 %. Die OIB-Richtlinie 3 fordert für Aufenthaltsräume eine Lichteintrittsfläche bezogen auf die Bodenfläche des jeweiligen Raums; daraus folgt kein allgemeiner gesetzlicher Mindestanteil an der gesamten Fassadenfläche.

Alle automatischen Werte bleiben Orientierungswerte. Manuelle Werte werden getrennt gespeichert, haben Vorrang und behalten ihre Herkunft.

Quellennachweise:
- TU Wien, *Verhältnis der Nutzungsfläche (NUF) zur Brutto-Grundfläche (BGF)*: https://repositum.tuwien.at/handle/20.500.12708/15291
- OIB, Erläuternde Bemerkungen zur Richtlinie 6 (Bezugs-Geschoßhöhe 3 m in bestimmten Energiekennzahlen): https://www.oib.or.at/sites/default/files/erlaeuternde_bemerkungen_richtlinie_6_26.03.15_0.pdf
- OIB-Richtlinie 3, Ausgabe Mai 2023 (Belichtung von Aufenthaltsräumen): https://www.oib.or.at/sites/default/files/oib-rl_3_ausgabe_mai_2023.pdf

### Standortprüfungen

- Gelände, Solar, Umweltwärme, Naturgefahren, Kultur und Radon verwenden die jeweils dokumentierten TIRIS-/Fachdienste.
- Naturgefahrenabfragen laufen begrenzt parallel.
- nicht erreichbare Daten werden als nicht geprüft, nicht als unauffällig behandelt.

## Klima

- INCA-Jahrespakete werden adressbezogen über Koordinaten/Rasterzelle geladen.
- vollständige Jahre werden automatisch aus Manifest und Jahresindex erkannt.
- OIB NAT/TNAT,13 werden über die amtliche Zuordnung geladen.
- Klima ist eigenständig; Heizlast und Energiefluss verwenden denselben Klimakern.
- Der Beratungsimpuls ordnet die klimatische Heizbeanspruchung anhand der Vollbenutzungsstunden ein: unter 1.800 h vergleichsweise mild, über 2.400 h erhöht, dazwischen mittlere Orientierung. Ab 100 Stunden unter −10 °C wird eine Kältephasen-Notiz ergänzt; ab 10 Hitzetagen oder 2 Tropennächten ein Hinweis zum sommerlichen Wärmeschutz.
- Diese Schwellen sind bewusst einfache Beratungsregeln und keine normativen Klimaklassen. Der JSON-Export liegt gemeinsam mit Rechenweg und Quellen im Abschnitt „Methode und Datenbasis“.

## Heizlast

- verbrauchsbasierte Abschätzung aus Heizenergieverbrauch, Nutzwärmefaktor und klimatischen Vollbenutzungsstunden,
- flächenbezogene Orientierung als Plausibilitätskorridor,
- Klimagrundlage aus gemeinsamem Dienst; NAT wird für die Heizlast verwendet, TNAT,13 bleibt dem Klima-/Sommerkontext vorbehalten,
- Heizgrenztemperatur manuell oder als transparenter Vorschlag,
- Gebäudezustand automatisch aus dem korrigierten Verbrauchs-HWB vorgeschlagen; fehlt eine belastbare BGF, wird BGF = beheizte Nutzfläche / 0,75 als klar gekennzeichneter Ersatz angesetzt,
- Einordnung des Vorschlags: über 150 kWh/(m²a) unsanierter Altbau, 90–150 teilsanierter Bestand, 45–unter 90 sanierter Bestand, darunter neuerer Standard/Neubau,
- eine manuelle Gebäudezustandsauswahl hat immer Vorrang,
- technische Standortkarten zeigen nur für die Beratung relevante Zuordnungs-, Klima- und Höhenbezüge; interne KG-Nummern werden nicht als eigene Kennzahl ausgegeben,
- sichtbar priorisiert werden die erforderliche Leistung für 90 % der Heizstunden, die zusätzliche Spitzenleistung und – bei eingetragenen Anlagenleistungen – ein gemeinsamer Anlagenabgleich mit Reserve- und Teillastprüfung,
- Heizgradtage, Vollbenutzungsstunden, Temperaturkorrekturen und weitere Rechenzwischenwerte stehen nur unter „Methode und Datenbasis“,
- keine Gleichsetzung mit einer vollständigen normativen Heizlastberechnung.

## Energiefluss V4

Der gemessene Verbrauch bleibt die Energiebilanz. U-Werte und Flächen verteilen den Hüllverlust auf Bauteile und bilden eine unabhängige Plausibilitätsprüfung.

Wichtige Zusammenhänge:

```text
Nutzwärme = Heizenergieverbrauch × Nutzwärmefaktor (JNG / JAZ)
Umweltwärme = max(Nutzwärme − Heizenergieverbrauch, 0)
Raumwärme = Nutzwärme − Warmwasseranteil
HWB_Verbrauch = Raumwärme / Bezugsfläche
UA_i = U_i × A_i
```

Der rechnerische Hüllvergleich nutzt U×A, Klima, Lüftung, Wärmebrücken und Gewinne. Er ist eine Beratungsplausibilisierung, kein Energieausweis.

## Bauteil & Sanierung

### Opake Bauteile

```text
R_bestand = 1 / U_bestand
R_neu = R_bestand + d / λ
U_neu = 1 / R_neu
```

Varianten werden intern genauer und sichtbar in 2-cm-Schritten gerechnet.

### Fenster und Türen

Diskrete Austauschvarianten mit festem U-Wert und Preisniveau.

Fenster:

- Energie und Kosten nach Fensterfläche.
- Rahmenmaterial beeinflusst Nutzungsdauer-/Instandhaltungsansatz.

Haustür:

```text
Gesamtfläche = Anzahl × typische Fläche je Tür
Energiewirkung nach Gesamtfläche
Investitionskosten nach Anzahl × Stückpreis
```

### Wirtschaftlichkeit

Getrennt darstellen:

- Vollkosten,
- Sowiesokosten,
- energetische Mehrkosten,
- projektbezogene Förderung,
- relevante Eigeninvestition,
- Gesamtkosten im Betrachtungszeitraum,
- dynamische Amortisation.

Kostenoptimum und kürzeste Amortisation verfolgen unterschiedliche Ziele und können bei verschiedenen Varianten liegen.

### Komfort

Die innere Oberflächentemperatur wird überschlägig aus U-Wert, Innen- und Außentemperatur abgeleitet. Wärmebrücken und lokale Anschlüsse sind separat zu prüfen.

## Rundung und Grenzen

Intern exakt rechnen. Sichtbar runden gemäß Projektübersicht. Hinweise zu Recht, Förderung, Feuchte, Wärmebrücken und Ausführungsplanung bleiben projektbezogen erforderlich.

---

## Vertiefung Energiefluss V4

### Verbrauch und Nutzwärme

```text
Q_Nutz = HEB × f_Nutz
Q_Umwelt = max(Q_Nutz − HEB, 0)
Q_WW = Personen × 1.000 kWh/(Person·a), wenn Warmwasser enthalten
Q_Raum = max(Q_Nutz − Q_WW, 0)
Q_Anlage = max(HEB − Q_Nutz, 0)
HWB_Verbrauch = Q_Raum / BGF
```

Einfache Korrektur:

```text
K_T = 1 + (T_Raum − 20 °C) × 0,06
K_beheizt = 1 + (beheizter Anteil − 100 %) × 0,005
HWB_korrigiert = HWB_Verbrauch / K_T / K_beheizt
```

### Gewinne und Lüftung

```text
Q_intern = 2,7 W/m² × beheizte Nutzfläche × 8,76
Q_solar = 175 kWh/(m²a) × Fensterfläche × 0,70 × Nutzungsfaktor
V_konditioniert = Bruttovolumen × beheizter Anteil / 100
Q_Lüftung = 10 kWh/(m³a) × V_konditioniert
```

### Verbrauchskalibrierte Gebäudehülle

```text
Q_Rest = Q_Ein − Q_Anlage − Q_WW − Q_Lüftung
Q_Bauteile = max(Q_Rest, 0) / 1,075
Q_Wärmebrücken = Q_Bauteile × 0,075
UA_i = U_i × A_i
Q_Bauteil,i = UA_i × Q_Bauteile / ΣUA
```

U-Wert-Änderungen verändern die Verteilung, nicht den gemessenen Gesamtverbrauch.

### Unabhängiger Hüllvergleich

```text
HGT = Vollbenutzungsstunden × (15 °C − NAT)
Q_Transmission = ΣUA × HGT / 1.000
Q_WB,rech = Q_Transmission × 0,075
Q_Raum,rech = max(Q_Transmission + Q_WB,rech + Q_Lüftung − Q_intern − Q_solar, 0)
HEB_rechnerisch = (Q_Raum,rech + Q_WW) / f_Nutz
Abweichung = (HEB_rechnerisch − HEB_gemessen) / HEB_gemessen × 100
```

Der Vergleich ist eine Plausibilisierung, kein exakter Sollverbrauch.

## Vertiefung Bauteil & Sanierung

### Energieeinsparung

Vorrangig wird ein kalibrierter Bauteilverlust aus Energiefluss verwendet:

```text
Q_neu = Q_Bestand × U_neu / U_Bestand
```

Ohne Energiefluss wird überschlägig aus Fläche, U-Wert, Heizgradstunden und Temperaturkorrektur gerechnet. Der sichtbare Tirol-Fallback HGT 22/14 beträgt 3.500 Kd/a und ist überschreibbar.

### Kosten

Dämmung:

```text
Vollkosten = Fläche × (Sockelkosten + Mehrkosten je cm × Dämmdicke)
```

Fenster:

```text
Vollkosten = Fensterfläche × Richtpreis der Variante
```

Haustür:

```text
Gesamtfläche = Anzahl × typische Fläche je Tür
Vollkosten = Anzahl × Richtpreis je Tür
```

Kostenbrücke:

```text
Gesamtkosten
− Sowiesokosten
= energetische Mehrkosten
− bestätigte Förderung
= relevante Eigeninvestition
```

### Dynamische Wirtschaftlichkeit

Der gemeinsame Kern kann Anfangsinvestition, Wiederbeschaffung, Restwert, Entsorgung, Energie, Instandhaltung, Preisentwicklung und Kalkulationszins berücksichtigen. Dargestellt werden Barwert-Gesamtkosten und dynamische Amortisation. Sensitivitätsanalysen sind bei langfristigen Annahmen empfohlen.

### Nutzungsdauer

Die Standarddatei unterscheidet informative Normwerte und transparent gekennzeichnete Projekt-Fallbacks. Jeder Wert bleibt überschreibbar und benötigt Quelle, Status und Datenstand.
