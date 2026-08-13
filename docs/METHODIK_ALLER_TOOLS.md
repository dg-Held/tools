# Methodik aller Tools

**Stand:** 13.08.2026

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

Geschoßzahl und NFL sind die wichtigsten Prüfeingaben. Sie bleiben bei eingeklappter Detailtabelle in einer kompakten Zusammenfassung sichtbar. Aus `Grundfläche_verwendet = BGF / Geschoße` werden OGD, unterster Abschluss und Gebäudevolumen nachgeführt. Die Außenwand wird bei geänderter Grundfläche über die Quadratwurzel des Flächenverhältnisses skaliert; dadurch folgt der Umfang bei ähnlicher Gebäudeform plausibler als bei linearer Skalierung. Die Dachprojektion bleibt dagegen das amtliche TIRIS-Dachpolygon und wird nicht aus NFL oder BGF neu abgeleitet.

```text
Fassade_brutto,technisch = TIRIS-Umfang × √(Grundfläche_verwendet / Dachprojektion) × Medianhöhe
Fenster = Fassade_brutto,technisch × Fensteranteil
Außenwand_opak = Fassade_brutto,technisch − Fenster
OGD = Kellerdecke = Grundfläche_verwendet
Dachschräge = TIRIS-Dachprojektion / cos(Dachneigung)
Gebäudevolumen = Grundfläche_verwendet × Medianhöhe
```

**Einheitliche Außenwanddefinition ab Geometriemodell v1.5:** Nutzerseitig bedeutet „Außenwand“ in Standortpass, Energiefluss, Bauteil & Sanierung und später Wirtschaftlichkeit immer die **opake Außenwandfläche ohne Fenster**. Fenster werden separat geführt. Die technische Brutto-Fassade ist nur noch eine interne Ableitungs-/Referenzgröße. Frühere Standortpass-Projekte, in denen eine manuelle „Außenwand“ noch als Brutto-Fassade gespeichert wurde, werden beim Laden einmalig als opake Nutzerfläche migriert; die Fenster werden danach nicht nochmals abgezogen.

Der Fensteranteil ist als Beratungsregler von 10 bis 50 % voreingestellt auf 20 %. Die OIB-Richtlinie 3 fordert für Aufenthaltsräume eine Lichteintrittsfläche bezogen auf die Bodenfläche des jeweiligen Raums; daraus folgt kein allgemeiner gesetzlicher Mindestanteil an der gesamten Fassadenfläche.

Die kompakte Geometriezeile zeigt Geschoßzahl, NFL, beheizten Anteil und einen einfachen Plausibilitätsstatus. „Geometrie plausibel“ bedeutet nur, dass die Kernwerte vollständig sind und eine gleichzeitig manuell eingetragene BGF/NFL nicht deutlich vom 0,75-Verhältnis abweicht; es ist keine geometrische oder baurechtliche Prüfung.

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

Das Klima-Tool arbeitet mit den vorberechneten stündlichen GeoSphere-INCA-Rasterwerten des zur Adresse nächstgelegenen Rasterpunkts. Vollständige Jahre werden aus Manifest und Jahresindex erkannt; OIB-NAT/TNAT,13 sowie TIRIS-Höhenbezug bleiben als getrennte amtliche Grundlagen nachvollziehbar.

### Jahresauswertung und Heizkennwerte

Für jedes verfügbare Jahr werden die gültigen Stundenwerte `T_a,h` ausgewertet:

```text
Heizstunde, wenn T_a,h < 15 °C
HGT_15 = Σ max(15 − T_a,h, 0)
VLS_15 = HGT_15 / (15 − NAT)
       = Σ max(0, (15 − T_a,h) / (15 − NAT))
```

Die Kennzahlen der Ergebniskarten sind arithmetische Mittel der vorhandenen Jahreswerte. Für die Temperaturdauerlinie werden die gültigen Temperaturen jedes Jahres sortiert und auf 8.760 Rangstunden interpoliert; für jede Rangstunde werden P10, Median und P90 über alle Jahre gebildet. Die Stundenhäufigkeit wird in 1-K-Klassen gezählt und auf 8.760 Stunden normiert.

### Kälte- und Sommerkennwerte

```text
Kältestunden = direkte Anzahl der Stunden unter 0 / −5 / −10 °C
NAT-Stunden = Anzahl T_a,h ≤ NAT
```

Ein Hitzetag wird nur aus einem Tag mit mindestens 20 gültigen Stundenwerten gebildet; Tagesmaximum ≥ 30 °C zählt als Hitzetag, ≥ 35 °C zusätzlich als extremer Hitzetag. Eine Tropennacht erfordert alle 13 Stundenwerte von 18–06 UTC; das Minimum muss ≥ 20 °C sein. Das minimale 24-h-Mittel ist das kleinste Mittel eines vollständigen gleitenden 24-Stunden-Fensters.

### Beratungsimpuls

Der Beratungsimpuls ist bewusst nicht normativ:

- VLS < 1.800 h → vergleichsweise milder Standort,
- VLS > 2.400 h → erhöhte klimatische Heizbeanspruchung,
- dazwischen → mittlere Orientierung,
- ab 100 h unter −10 °C → zusätzlicher Kältephasen-Hinweis,
- ab 10 Hitzetagen oder 2 Tropennächten im Jahresmittel → Hinweis zum sommerlichen Wärmeschutz.

Die Schwellen sind reine Beratungsregeln, keine normativen Klimaklassen. Gebäudestandort, INCA-Rasterpunkt, TIRIS-Geländehöhe und OIB-ELEVmin werden getrennt ausgewiesen; es erfolgt keine automatische Höhenkorrektur. Der technische JSON-Export befindet sich im eingeklappten Abschnitt „Methode und Datenbasis“.

## Heizlast

Die Heizlast ist eine vereinfachte, verbrauchs- und flächenbasierte Orientierung; sie ist keine vollständige Norm-Heizlastberechnung. Klima, NAT, Adresse und Geometrie stammen aus derselben gemeinsamen Projektbasis wie Klima und Energiefluss.

### Klimatische Lastfunktion und Vollbenutzungsstunden

Für jede Rangstunde gilt bei der verwendeten Heizgrenze `T_HG`:

```text
L_h = max(0, (T_HG − T_a,h) / (T_HG − NAT))
```

Bei 15 °C Heizgrenze werden die Vollbenutzungsstunden direkt aus dem Klimapaket verwendet. Bei geänderter Heizgrenze:

```text
VLS_neu = VLS_15 × ΣL_neu / ΣL_15
```

### Verbrauchsmethode

```text
Q_Nutz = HEB × f_Nutz
Q_WW = Personen × 1.000 kWh/a, wenn Warmwasser enthalten
Q_Raum = max(Q_Nutz − Q_WW, 0)
P_Verbrauch = Q_Raum / VLS
```

`HEB` ist der gemeinsame Heizenergieverbrauch; `f_Nutz` der gemeinsame Nutzwärmefaktor (JNG/JAZ).

### Heizgrenzen-Vorschlag

Zunächst:

```text
q_Raum = Q_Raum / beheizte Nutzfläche
```

Vorschlag:

```text
q_Raum > 150 kWh/m²a       → 16 °C
100 bis 150                → 15 °C
50 bis < 100               → 14 °C
25 bis < 50                → 13 °C
< 25                       → 12 °C
keine verwertbare Grundlage → 15 °C
```

Manuell eingegebene Heizgrenzen werden auf 8–18 °C begrenzt und haben Vorrang.

### Flächenmethode, eingegebener HWB und Gebäudezustand

```text
P_Fläche,min/max = beheizte NFL × Kennwert_min/max / 1.000
Q_HWB = HWB × BGF
P_HWB = Q_HWB / VLS
```

Die W/m²-Bandbreiten nach Gebäudezustand sind Beratungsfaustformeln, keine Normwerte.

Der automatische Gebäudezustand verwendet dieselbe Verbrauchs-HWB-Logik wie Energiefluss. Fehlt eine bekannte BGF, gilt vorläufig:

```text
BGF = beheizte Nutzfläche / 0,75
HWB_V = Q_Raum / BGF
K_T = 1 + (T_Raum − 20) × 0,06
K_beheizt = 1 + (beheizter Anteil − 100) × 0,005
HWB_korr = HWB_V / K_T / K_beheizt
```

Einordnung: > 150 kWh/(m²a) unsanierter Altbau, 90–150 teilsanierter Bestand, 45–< 90 sanierter Bestand, < 45 neuerer Standard/Neubau. Eine manuelle Auswahl hat immer Vorrang.

### Heizleistungs-Dauerlinie und Anlagenabgleich

Referenz ist vorrangig `P_Verbrauch`, sonst die Mitte der flächenbezogenen Bandbreite:

```text
P_h = P_ref × L_h
P_90 = 90-%-Quantil aller positiven P_h
zusätzliche Spitzenleistung = max(P_ref − P_90, 0)
```

Bei eingetragenen Anlagenleistungen:

```text
f_dim = P_max / P_ref
Reserve = (f_dim − 1) × 100 %
Auslastung bei NAT = P_ref / P_max × 100 %
T_Volllast = T_HG − f_dim × (T_HG − NAT)
```

Stunden unter Mindestleistung sind positive Heizstunden mit `P_h < P_min`; dies ist nur eine Takt-/Teillast-Plausibilisierung.

### Grenzen

Warmwasser-Spitzen, Aufheizreserven, Speicher, Regelung, hydraulische Einflüsse, solare Gewinne und tatsächliche Zusatz-/Ofennutzung werden nicht stundengenau abgebildet. Die 90-%-Leistung ist eine Beratungsgröße für Leistungsanteile und keine monovalente Auslegungsempfehlung. Technische Zwischenergebnisse und der JSON-Export liegen ausschließlich unter „Methode und Datenbasis“.

## Energiefluss V4

Das Tool verbindet den eingegebenen Heizenergieverbrauch mit der gemeinsamen Gebäudegeometrie und einem unabhängigen Hüllvergleich. Dieselben Projektwerte heißen und funktionieren in Standortpass, Heizlast und Energiefluss gleich:

- Nutzfläche (NFL),
- davon beheizt,
- Bruttogeschoßfläche (BGF),
- oberirdische Geschoße und Gebäudevolumen,
- Personen,
- Heizenergieverbrauch,
- Nutzwärmefaktor (JNG / JAZ),
- Warmwasser enthalten,
- Gebäudezustand.

Änderungen an NFL, beheiztem Anteil, BGF oder Geschoßzahl laufen über die gemeinsame Geometriekette. Aus einer bekannten NFL wird bei fehlender BGF zunächst `BGF = NFL / 0,75` abgeleitet. Geschossflächen, Fassade und Gebäudevolumen folgen der verwendeten Grundfläche; die Dachfläche bleibt am TIRIS-Dachpolygon und ändert sich nur mit der Dachneigung. Die Geschoßzahl liegt als wichtige, aber seltener benötigte Prüfeingabe im eingeklappten Bereich.

Für Baujahr beziehungsweise Baubewilligung gibt es bewusst keinen stillen Standardwert. Die sichtbare Beispielangabe 1970 ist nur eine Eingabehilfe: Ein automatisch gespeichertes Baujahr würde unmittelbar Bestands-U-Werte vorschlagen und könnte eine unbekannte Ausgangslage fälschlich als bestätigt erscheinen lassen.

Der Gebäudezustand wird wie im Heizlasttool aus dem korrigierten verbrauchsbasierten HWB vorgeschlagen. Bekannte manuelle Angaben haben Vorrang. Die Einordnung lautet:

- über 150 kWh/(m²a): unsanierter Altbau,
- 90 bis 150 kWh/(m²a): teilsanierter Bestand,
- 45 bis unter 90 kWh/(m²a): sanierter Bestand,
- unter 45 kWh/(m²a): neuerer Standard / Neubau.

Der gemessene Verbrauch bleibt die Grundlage der sichtbaren Energiebilanz. U-Werte und Hüllflächen verteilen die kalibrierten Bauteilverluste und bilden zusätzlich einen unabhängigen Plausibilitätsvergleich. Die Ergebniskennzahlen werden bewusst getrennt bezeichnet:

- **HWB aus Verbrauch**,
- **HWB korrigiert**,
- **HWB aus U-Werten**,
- **Abweichung** zwischen rechnerischem und eingegebenem Heizenergieverbrauch.

Der rechnerische Heizenergieverbrauch steht direkt beim Hüllvergleich. Der Klimastatus zeigt, ob der Vergleich noch berechnet oder mit dem vorhandenen Klimazeitraum aktualisiert wurde. Rechenweg, Annahmen, Datenherkunft und Grenzen stehen vollständig unter „Methode und Datenbasis“.

Als Stand-alone-Tool trennt Energiefluss bewusst zwei Schritte: „Standort analysieren“ ermittelt die Gebäudegeometrie, „Klimawerte berechnen“ ergänzt die standortbezogene Grundlage für den unabhängigen U-Wert-/Hüllvergleich. Die verbrauchsbasierte Bilanz selbst aktualisiert sich direkt und benötigt keinen dritten allgemeinen Berechnen-Knopf.

Der Fensterflächenanteil ist im Energiefluss als gemeinsamer Regler von 10 bis 50 % sichtbar; Standard sind 20 %. Er bezieht sich auf die technische Gesamtfassade und führt die gemeinsame Fensterfläche sowie die solaren Gewinne nach. Eine bewusst bestätigte opake Außenwandfläche bleibt als eigener gemeinsamer Projektwert erhalten. Eine direkt eingegebene Fensterfläche hat wiederum Vorrang vor der automatischen Fensterableitung. Damit verwenden Standortpass, Energiefluss und Bauteil & Sanierung dieselben zwei Flächenwerte: **Außenwand opak** und **Fenster**.

### Praxisvalidierung des „HWB aus U-Werten“ und Methodenentscheidung

**Normativer Bezug und Abgrenzung:** Der OIB-Leitfaden „Energietechnisches Verhalten von Gebäuden“, Ausgabe September 2025, verweist für Klimamodell/Nutzungsprofile auf ÖNORM B 8110-5, für Heizwärme- und Kühlbedarf auf ÖNORM B 8110-6-1 und für den Heizenergiebedarf auf ÖNORM H 5056-1. Der folgende U-Wert-Vergleich bildet diese Normberechnung bewusst **nicht** nach, sondern bleibt eine transparente Beratungsplausibilisierung. Bei Gradtag-/Gradstundenverfahren kann eine gegenüber der Raum-Solltemperatur abgesenkte Basistemperatur bereits interne und solare Gewinne implizit abbilden; ein zusätzlicher vollständiger Gewinnabzug muss deshalb methodisch mit der gewählten Basistemperatur konsistent sein. Dieser Zusammenhang ist u. a. in NREL-Arbeiten zu variable-base degree days beschrieben.

Quellen für diese Abgrenzung: OIB-Richtlinie 6 – Leitfaden 2025, Punkt 2.1; Austrian Standards, ÖNORM B 8110-6-1; NREL, „Variable-Base Degree-Day Correction Factors for Energy Savings Calculations“.

Bis 10.08.2026 wurde bewusst noch mit dem bisherigen Diagnosemodell gerechnet:

```text
HGT15 = VLS15 × (15 − NAT)
Q_T = Σ(U × A) × HGT15 / 1.000
Q_WB = 0,075 × Q_T
Q_Raum,U = max(Q_T + Q_WB + Q_Lüftung − Q_intern − Q_solar, 0)
HWB_U = Q_Raum,U / BGF
```

Die Praxisfälle und insbesondere der zusätzliche Bestands-Energieausweis zeigten, dass `ΣUA` und Lüftung teilweise gut getroffen wurden, der Jahres-Transmissionsverlust aber durch die Kombination aus abgesenkter 15-°C-Basis und anschließend vollständigem Gewinnabzug systematisch zu niedrig ausfallen kann. Für den V1.0-Abschlussstand wurde deshalb am 11.08.2026 auf den weiter unten vollständig dokumentierten Raumtemperatur-/Gewinnnutzungsansatz umgestellt. Dieser Ansatz ist der festgelegte V1.0-Methodenstand. Er bleibt eine transparente Beratungspauschale; zusätzliche reale Energieausweise können in späteren V1.x-Versionen zur Weiterentwicklung herangezogen werden.

Die Praxisfälle zeigten, dass ein einfaches Streichen der Gewinne **nicht robust** wäre. Die folgende Tabelle dokumentiert deshalb bewusst die damalige Diagnose des **verworfenen HGT15-Ansatzes nach der Außenwand-v1.5-Korrektur**; sie ist nicht der heutige V1.0-HWB-U:

| Praxisfall | HWB korrigiert | früherer HWB-U (HGT15) | Abweichung | ohne expliziten Gewinnabzug | Abweichung |
|---|---:|---:|---:|---:|---:|
| A · großes Mehrparteienhaus, reale Beratung + Energieausweis | 51,2 | 16,3 | −68,1 % | 48,5 | −5,3 % |
| B · kleines Einfamilienhaus, reale Beratung + Energieausweis | 181,5 | 138,0 | −24,0 % | 180,2 | −0,7 % |
| C · theoretischer Testfall | 177,8 | 178,7 | +0,5 % | 218,1 | +22,6 % |
| D · Einfamilienhaus, reale Beratung ohne Energieausweis | 159,1 | 153,8 | −3,3 % | 210,5 | +32,3 % |

Fall A hatte 1.400 m² bereits opake Außenwand als Nutzereingabe, wurde im alten Modell aber nochmals um 400 m² Fenster reduziert; Fall B hatte denselben Semantikfehler in kleinerem Umfang. Die v1.5-Migration übernimmt diese früheren Standortpass-Werte deshalb als opake Außenwand. Die Flächenkorrektur verbessert den U-Wert-Vergleich, erklärt die gesamte Differenz jedoch nicht.

Der **festgelegte V1.0-Methodenstand** ist separat als Regression in `tests/diagnose-hwb-u-practice-cases.js` hinterlegt:

| Fall | Referenzart | Referenz-HWB | V1.0-HWB aus U-Werten | Abweichung |
|---|---|---:|---:|---:|
| A | real + Energieausweis | 48,0 | 37,0 | −22,9 % |
| B | real + Energieausweis / Verbrauchsreferenz | 181,5 | 194,7 | +7,3 % |
| C | theoretischer Testfall | 177,8 | 244,6 | +37,6 % |
| D | real, ohne Energieausweis | 159,1 | 222,0 | +39,6 % |
| E | real + Bestands-Energieausweis | 79,3 | 72,2 | −8,9 % |

Diese Werte sind **Regressionen der implementierten Beratungslogik und keine normativen Sollwerte**. Fall A und E besitzen einen ausdrücklich genannten Energieausweis-Referenzwert. Bei B und D dient primär die Verbrauchsreferenz der Plausibilisierung; Fall C ist ein theoretischer Kontrollfall. Die Spannweite der Abweichungen ist bewusst sichtbar und begründet, warum der Wert als unabhängiger Plausibilitätscheck und nicht als Energieausweis-HWB bezeichnet wird.


Ein zusätzlicher Diagnosewert bestätigt, dass kein einzelner pauschaler Gewinnnutzungsgrad die vier Fälle repariert: Um den korrigierten verbrauchsbasierten HWB bei unverändertem `HGT15` exakt zu treffen, müsste der Anteil der abziehbaren Jahresgewinne in A und B sogar negativ sein (ca. −0,09 bzw. −0,03), in C dagegen ca. 1,02 und in D ca. 0,91. Das ist kein physikalisch sinnvoller gemeinsamer Parameter, sondern ein Hinweis darauf, dass **Bilanztemperatur, U-/Flächenannahmen, Lüftungsansatz und Gewinnansatz gemeinsam** betrachtet werden müssen. Das Diagnose-Skript `tests/diagnose-hwb-u-practice-cases.js` hält die anonymisierten Ausgangsfälle und zusätzlich den aktuellen V1.0-Vergleich reproduzierbar fest. Die Fälle sind Regressionen für die Beratungslogik, keine normativen Sollwerte.

Die große Differenz zwischen der im **verbrauchskalibrierten Energiefluss** ausgewiesenen Gebäudehülle und der aus **U × A × Klima** berechneten Transmission ist kein direkter Vergleich zweier gleichartiger Größen:

- Die grafische Gebäudehülle ist eine **Restgröße zur Schließung der Verbrauchsbilanz**. Sie enthält denjenigen Hüllverlust, der nach eingegebenem Verbrauch, Nutzwärmefaktor, Warmwasser, Lüftung sowie den pauschalen internen/solaren Einträgen übrig bleiben muss. Die U-Werte verteilen diese Restgröße nur auf die aktiven Bauteile.
- Der unabhängige Hüllvergleich berechnet die Transmission tatsächlich aus `ΣUA × HGT`. Er ist nicht am Verbrauch kalibriert.

Im großen Mehrparteienhaus lagen deshalb rund 201 MWh/a verbrauchskalibrierter Bauteilverlust einer U-basierten Transmission von nur rund 64 MWh/a gegenüber. Das zeigt eine **Modellinkonsistenz bzw. nicht zusammenpassende Annahmen**, nicht automatisch einen Rechenfehler in `U × A × HGT`.

Für V1.0 wurde die Methodenentscheidung abgeschlossen. Verwendet wird ein **vereinfachtes explizites Wärmebilanzmodell**: Transmissions- und Lüftungsverluste werden unabhängig aus Hülle und Standortklima ermittelt; interne und solare Gewinne werden mit einem transparenten pauschalen Nutzungsfaktor berücksichtigt. Damit ist der zweite Prüfweg methodisch vom verbrauchsbasierten HWB getrennt.

Ein echtes Bilanztemperaturmodell mit geeigneter variabler Basistemperatur bleibt eine mögliche spätere V1.x-Weiterentwicklung, falls zusätzliche Klima-/Nutzungsgrößen und genügend unabhängige Referenzfälle einen klaren Vorteil zeigen. Der V1.0-HWB-U-Wert bleibt ausdrücklich ein **Beratungs-Plausibilitätswert** und ersetzt keinen Energieausweis-HWB.

### Für spätere Versionen vorgemerkt

- **Angrenzende Gebäude:** einfache Zusatzangabe `davon an Nachbargebäude angrenzend: ___ m²`; keine komplexe Randbedingungsmatrix. Später muss eindeutig festgelegt werden, welche Fläche aus dem Außenluft-Transmissionsverlust und aus automatischen Fassadensanierungsmaßnahmen herausgenommen wird.
- **Warmwasser/Zirkulation bei größeren zentralen Anlagen:** die Personenpauschale bleibt für kleine Gebäude die einfache Standardmethode. Für MFH soll später optional ein transparenter Verteil-/Zirkulationsverlust ergänzt werden. Bevorzugter MVP ist ein **separater, standardmäßig leerer Zuschlag in kWh/a oder % des Warmwasser-Nutzwärmebedarfs**, damit keine ungesicherte versteckte Pauschale entsteht. Eine vollständige Rohrnetz-/Haustechnikberechnung ist nicht Ziel dieses Tools.

## Bauteil & Sanierung

### Schnelle Projektgrundlage

Der normale Beratungsweg benötigt nur wenige sichtbare Prüfschritte:

1. Adresse auswählen und Gebäudegeometrie analysieren,
2. Baujahr/Baubewilligung prüfen,
3. Nutzfläche (NFL) prüfen,
4. gewünschtes Bauteil auswählen.

Aus der gemeinsamen Gebäudegeometrie werden die Bauteilflächen übernommen. Aus einem bekannten Baujahr werden für alle unterstützten Bauteile Bauperioden-U-Werte als Vorschläge hinterlegt. Damit sind Außenwand, oberste Geschoßdecke, Dach, Kellerdecke/Boden, Fenster und Außentür grundsätzlich vorbereitet, ohne jedes Bauteil zuerst einzeln öffnen zu müssen. Tatsächliche Bauteilaufbauten, frühere Sanierungen und bekannte Flächen haben immer Vorrang.

NFL und Baujahr allein ersetzen keine Geometrie: Für Außenwand, Fenster, Dach und Geschossflächen werden zusätzlich TIRIS-Geometrie oder bekannte manuelle Gebäudegrößen benötigt. Ist der Standort bereits im Projekt analysiert, genügt in der Regel die Prüfung von Baujahr und NFL.

Auch Bauteil & Sanierung ist stand-alone nutzbar: „Standort analysieren“ lädt die Geometrie. Ein eigener Klimaschritt wird nur benötigt, wenn weder kalibrierte Energieflussverluste noch geeignete Klimakennwerte im Projekt vorliegen. Technische Bauteilvarianten reagieren anschließend unmittelbar; nur die automatische Paketbildung ist als bewusster eigener Speicherschritt ausgeführt.

### Opake Bauteile

```text
R_bestand = 1 / U_bestand
R_neu = R_bestand + d / λ
U_neu = 1 / R_neu
d_erf = max(λ × (1/U_Ziel − 1/U_bestand) × 100, 0)   [cm]
```

Die rechnerisch erforderliche Dämmdicke wird für die sichtbare Empfehlung auf den vorgesehenen Dämmdicken-Schritt aufgerundet. Varianten werden intern genauer und sichtbar in 2-cm-Schritten gerechnet. Der frühere eigene Variantenblock entfällt; Mindeststandard, wirtschaftlicher Bereich und ambitionierte Variante werden direkt im Ergebnis gegenübergestellt.

### Fenster und Türen

Diskrete Austauschvarianten mit festem U-Wert und Preisniveau.

Fenster:

- Energie und Kosten nach Fensterfläche,
- Rahmenmaterial beeinflusst Nutzungsdauer und Instandhaltung.

Haustür:

```text
Gesamtfläche = Anzahl × typische Fläche je Tür
Energiewirkung nach Gesamtfläche
Investitionskosten nach Anzahl × Stückpreis
```

### Energiegrundlage

Vorrangig wird der im Energiefluss kalibrierte Verlust des gewählten Bauteils verwendet. Fehlt er, wird mit Standortklima beziehungsweise dem transparenten HGT-Fallback gerechnet. Damit bleibt das Tool auch ohne zuvor geöffneten Energiefluss rechenfähig. Für Türen gibt es im Energiefluss derzeit keinen eigenen kalibrierten Hüllverlust; dort wird deshalb Standortklima beziehungsweise HGT verwendet.

```text
mit Energiefluss:
Q_neu = Q_Bestand × U_neu / U_bestand

ohne Energiefluss:
HGT_h = vorhandene Heizgradstunden aus Klima/NAT
        oder HGT_Kd × 24
Q = A × U × HGT_h × f_Rand / 1.000

ΔQ_Nutz = max(Q_Bestand − Q_neu, 0)
ΔQ_End = ΔQ_Nutz / Nutzwärmefaktor
ΔK_Energie,a = ΔQ_End × Energiepreis
ΔCO₂_a = ΔQ_End × Emissionsfaktor
```

Technische Korrekturen bleiben eingeklappt.

### Kosten und Wirtschaftlichkeit

Die sichtbaren Kostenkarten zeigen Richtkostenmodell, Sowiesokosten und Finanzannahmen; Detailerklärungen liegen am i-Symbol. Kosten- und Finanzannahmen sind standardmäßig eingeklappt, bestätigte Förderungen bleiben offen sichtbar.

Getrennt dargestellt werden:

- Vollkosten,
- Sowiesokosten,
- energetische Mehrkosten,
- projektbezogene Förderung,
- relevante Eigeninvestition,
- Gesamtkosten im Betrachtungszeitraum,
- dynamische Amortisation.

Kostenoptimum und kürzeste Amortisation verfolgen unterschiedliche Ziele und können bei verschiedenen Varianten liegen. Der wirtschaftliche Bereich umfasst alle Varianten mit `B_Gesamt ≤ 1,05 × B_Gesamt,min`.

Vollständige im Tool verwendete dynamische Rechenlogik (kein Ersatz für den vollständigen Normtext):

```text
p = 1 + Preisänderung / 100
q = 1 + Zinssatz / 100
B_a = K_a × (p / q)^a

r = p / q
B_jährlich = K × r × (1 − r^T) / (1 − r)
bei r = 1: B_jährlich = K × T

B_Ersatz = Σ K_E × (p_K / q)^(n × L)       für n × L < T
f = (T mod L) / L
B_Entsorgung = Σ K_D × (p_D / q)^(n × L)     für n × L ≤ T
                + K_D × f × (p_D / q)^T       bei angebrochenem letzten Lebenszyklus
B_Restwert = K_letzte × (1 − f) × (p_K / q)^T
bei exaktem Lebensdauerende: B_Restwert = 0

B_Kapital = K_0 + B_Ersatz + B_Entsorgung − B_Restwert
B_Gesamt = B_Kapital + B_Verbrauch + B_Betrieb
A = B_Gesamt × (q − 1) / (1 − q^(−T))
bei q = 1: A = B_Gesamt / T
```

Ersatzinvestitionen werden an den Vielfachen der Nutzungsdauer innerhalb des Betrachtungszeitraums angesetzt. Entsorgung wird an den Lebensdauerenden und bei einem angebrochenen letzten Lebenszyklus anteilig am Periodenende berücksichtigt. Der Restwert ist der abgezinste, noch nicht verbrauchte Anteil der letzten Investition. Die dynamische Amortisation ist die erste Nullstelle der abgezinsten Kostendifferenz zwischen Variante und Referenz; zwischen zwei Jahreswerten wird linear interpoliert. Förderung wird separat in der Eigeninvestitionsbrücke ausgewiesen und verändert das technische Kostenoptimum nicht.

Ergänzende analytische Orientierung für geeignete opake Außenbauteile:

```text
c_N = Endenergiepreis / Nutzwärmefaktor
R_0 = 1 / U_bestand
c_V = 100 × Mehrkosten je cm      [€/m³]
F = Σ (p_E / q)^a                 für a = 1 ... T

d_opt = λ × [√(HGT × 24 × c_N × F / (λ × 1.000 × c_V)) − R_0]
d_opt = max(d_opt, 0)
```

Verwendet wird der aktuelle HGT-Wert des Bauteiltools (Standortwert oder transparenter HGT-Fallback). Die Formel ersetzt nicht den vollständigen Variantenvergleich und gilt nicht für erdberührte Bauteile.

### Automatische Maßnahmenpakete

Über einen eigenen, sichtbaren Schritt werden alle **für die thermische Hülle relevanten** und ausreichend vorbereiteten Bauteile gemeinsam ausgewertet. Der Relevanzstatus ist derselbe gemeinsame Projektwert, der im Energiefluss als „Aktiv“ geführt wird (`building.thermal.envelope.<bauteil>.enabled`). Im Bauteiltool kann er direkt beim geöffneten Bauteil geändert werden. Nicht relevante Bauteile bleiben im Projekt erhalten, werden aber weder für die automatische Hüllbilanz noch für automatische Maßnahmenpakete berücksichtigt.

Je relevantem Bauteil entstehen – soweit die Datengrundlage reicht – Entwürfe für:

- empfohlenen Mindeststandard,
- wirtschaftliche Variante,
- ambitionierte Variante.

Die Vorschläge werden unter `measures.auto-envelope-*` gespeichert. Jede Maßnahmenkarte speichert zusätzlich den Hüllstatus (`thermalEnvelope.relevant`) und den zugehörigen gemeinsamen Projektpfad. Drei Szenarien unter `scenarios.items.envelope-package-*` bündeln ausschließlich relevante Bauteile für das spätere Wirtschaftlichkeitstool. Automatisch erzeugte Einträge tragen `status = automatic-proposal` und `reviewStatus = not-reviewed`; vorhandene manuell gespeicherte Maßnahmen werden nicht überschrieben. Ändern sich Hüllstatus, Flächen, U-Werte, Klima-, Kosten- oder Finanzgrundlagen, markiert ein Fingerprint die Pakete als veraltet.

Technische Mindest- und ambitionierte Vorschläge können ohne Kostenrechnung entstehen. Für eine wirtschaftliche Variante werden zusätzlich Energiegrundlage, Kostenmodell, Nutzungsdauer, Energiepreis und Finanzannahmen benötigt.

### Komfort

Die innere Oberflächentemperatur wird überschlägig berechnet:

```text
T_si = T_i − U × (T_i − T_Rand) × R_si
```

Wärmebrücken, Feuchte und lokale Anschlüsse sind separat zu prüfen.

## Rundung und Grenzen

Intern exakt rechnen. Sichtbar runden gemäß Projektübersicht. Hinweise zu Recht, Förderung, Feuchte, Wärmebrücken und Ausführungsplanung bleiben projektbezogen erforderlich.

---

## Vertiefung Energiefluss V4

### Gemeinsame Eingaben und Geometrie

Die Eingaben werden nicht werkzeugspezifisch dupliziert, sondern über die gemeinsame Projektbasis gelesen und gespeichert. Für die Berechnung gelten die verwendeten Werte aus der zentralen Geometriekette:

```text
BGF = bekannter Projektwert
      oder NFL / 0,75
      oder TIRIS-Dachprojektion × oberirdische Geschoße

beheizte Nutzfläche = NFL × beheizter Anteil / 100
Grundfläche_verwendet = BGF / oberirdische Geschoße
Gebäudevolumen = Grundfläche_verwendet × Medianhöhe
```

Die Hüllflächen werden aus dem Standortpass übernommen oder dort beziehungsweise im Energiefluss manuell korrigiert. Änderungen an NFL oder BGF führen Außenwand, Geschossflächen und Volumen über die gemeinsame Ableitung nach. Die Dachprojektion bleibt unabhängig davon der amtliche TIRIS-Ausgangswert.

### Verbrauch, Nutzwärme und Umweltwärme

```text
Q_Nutz = HEB × f_Nutz
Q_Umwelt = max(Q_Nutz − HEB, 0)
Q_WW = Personen × 1.000 kWh/(Person·a), wenn Warmwasser enthalten
Q_Raum = max(Q_Nutz − Q_WW, 0)
Q_Anlage = max(HEB − Q_Nutz, 0)
HWB_Verbrauch = Q_Raum / BGF
```

`f_Nutz` ist der gemeinsame Nutzwärmefaktor: bei Kesseln der Jahresnutzungsgrad, bei Wärmepumpen die Jahresarbeitszahl und bei Direktheizung beziehungsweise Fernwärme meist ungefähr 1,0. Liegt der Faktor über 1, wird die zusätzlich genutzte Umweltwärme als eigener Energiezufluss dargestellt; dadurch bleibt die Bilanz auch bei Wärmepumpen geschlossen.

Einfache Verbrauchskorrektur:

```text
K_T = 1 + (T_Raum − 20 °C) × 0,06
K_beheizt = 1 + (beheizter Anteil − 100 %) × 0,005
HWB_korrigiert = HWB_Verbrauch / K_T / K_beheizt
```

Der daraus vorgeschlagene Gebäudezustand ist eine Beratungsorientierung und kein Energieausweis-Ergebnis.

### Gewinne und Lüftung

```text
Q_intern = 2,7 W/m² × beheizte Nutzfläche × 8,76
Q_solar = 175 kWh/(m²a) × Fensterfläche × 0,70 × Nutzungsfaktor
V_konditioniert = Gebäudevolumen × beheizter Anteil / 100
Q_Lüftung = 10 kWh/(m³a) × V_konditioniert
```

Die Ansätze sind transparente Standardannahmen. Sie können die reale Nutzung, Verschattung, Luftdichtheit und Lüftungsanlage nur überschlägig abbilden.

### Verbrauchskalibrierte Gebäudehülle

```text
Q_Rest = Q_Ein − Q_Anlage − Q_WW − Q_Lüftung
Q_Bauteile = max(Q_Rest, 0) / 1,075
Q_Wärmebrücken = Q_Bauteile × 0,075
UA_i = U_i × A_i
Q_Bauteil,i = UA_i × Q_Bauteile / ΣUA
```

Die sichtbare Energiebilanz folgt damit dem eingegebenen Verbrauch. Eingerückte Bauteile sind lediglich die Aufteilung der Gebäudehülle und werden im Rechenkern nicht ein zweites Mal summiert; dieser technische Hinweis wird in der Oberfläche nicht mehr benötigt.

### Bauteilvergleich in der Hülltabelle

Die Energieflussgrafik und die rechte Verlustspalte der Hülltabelle zeigen bewusst zwei verschiedene Blickwinkel:

```text
Grafik oben = verbrauchsbasierter, kalibrierter Bauteilverlust
Tabelle = unabhängiger Transmissionsverlust aus U × A × Standortklima

Q_Bauteil,U = U_i × A_i × HGT_rech / 1.000
```

Damit kann je Bauteil geprüft werden, ob die aus dem Verbrauch erforderliche Verlustgröße und die aus Fläche/U-Wert erwartete Verlustgröße in einer ähnlichen Größenordnung liegen. Wärmebrücken und Lüftung bleiben eigene Bilanzpositionen und werden nicht auf einzelne Bauteile verteilt. Fehlen Klimadaten, wird kein scheinbar genauer unabhängiger Bauteilverlust ausgegeben.

Die Summenzeile der Hülltabelle folgt derselben Trennung:

```text
Summe UA = Σ(U_i × A_i) der aktiven Bauteile
Kalibrierfaktor = Q_Bauteile,Verbrauch / ΣUA
Hülle aus U-Werten = Σ Q_Bauteil,U = Q_Transmission
```

„Hülle aus U-Werten“ ist damit die Summe genau jener unabhängigen Transmissionsverluste, die in der rechten Tabellenspalte stehen. Sie ist **nicht** identisch mit der verbrauchskalibrierten „Gebäudehülle“ der Grafik. Wärmebrücken werden anschließend separat im unabhängigen HWB-U-Wert-Modell berücksichtigt.

### Unabhängiger Hüllvergleich

Der verbrauchsbasierte HWB bleibt davon vollständig unabhängig. Für den zweiten Prüfweg werden U-Werte, Hüllflächen, Standortklima, Lüftung und Gewinne verwendet. Der frühere Ansatz mit 15 °C Bilanztemperatur und anschließend vollständigem Gewinnabzug wurde nach den Praxisfällen verworfen, weil dadurch Gewinne methodisch zu stark berücksichtigt werden konnten.

```text
HGT_rech ≈ Vollbenutzungsstunden × (T_Raum − NAT)
Q_Transmission = ΣUA × HGT_rech / 1.000
Q_WB,rech = Q_Transmission × 0,075
Q_Gewinne,nutzbar = (Q_intern + Q_solar) × 0,55
Q_Raum,rech = max(Q_Transmission + Q_WB,rech + Q_Lüftung − Q_Gewinne,nutzbar, 0)
HWB_U-Werte = Q_Raum,rech / BGF
HEB_rechnerisch = (Q_Raum,rech + Q_WW) / f_Nutz
Verbrauchsabweichung = (HEB_rechnerisch − HEB_eingegeben) / HEB_eingegeben × 100
```

Die Umrechnung der vorhandenen INCA-Vollbenutzungsstunden auf die gewählte Raumtemperatur und der Gewinnnutzungsfaktor 0,55 sind bewusst vereinfachte Beratungsannahmen. Der **HWB aus U-Werten** bleibt ein unabhängiger Plausibilitätswert und ist vom **rechnerischen Heizenergieverbrauch** zu unterscheiden. Die vierte Kennzahl heißt deshalb bewusst **Verbrauchsabweichung**; sie vergleicht nicht die beiden HWB-Werte, sondern `HEB_rechnerisch` mit dem eingegebenen Heizenergieverbrauch. Der Vergleich ist weder Energieausweis-HWB noch Normberechnung; er soll zeigen, ob Verbrauch, eingegebene U-Werte und gemeinsame Gebäudegeometrie in einer plausiblen Größenordnung liegen. Die Praxisfälle bleiben als Regression/Diagnose des festgelegten V1.0-Methodenstands dokumentiert. Zusätzliche reale Beratungsfälle dürfen die Datengrundlage in V1.x erweitern, ohne dass dadurch der abgeschlossene V1.0-Stand nachträglich offen bleibt.

### Bestands-U-Werte

Bestätigte manuelle U-Werte haben Vorrang. Fehlt ein bestätigter Wert, darf das bekannte Baujahr eine transparente Baualtersklassen-Empfehlung liefern. Ohne bekanntes Baujahr bleibt der Wert als unsicher beziehungsweise zu prüfen gekennzeichnet; die Eingabehilfe „z. B. 1970“ wird nicht im Projekt gespeichert.

### Grenzen

Besonders große Abweichungen können durch unvollständige Verbrauchszeiträume, ungewöhnliche Nutzung, Leerstand, Zusatzheizungen, falsche Flächen, nicht passende U-Werte, Lüftungsanlagen, solare Gewinne oder Klimabezüge entstehen. Das Tool zeigt diese Differenz bewusst als Gesprächs- und Prüfhinweis, nicht als automatische Fehlerkorrektur.

## Vertiefung Bauteil & Sanierung

### Energieeinsparung

Vorrangig wird ein kalibrierter Bauteilverlust aus Energiefluss verwendet:

```text
Q_neu = Q_Bestand × U_neu / U_Bestand
```

Ohne Energiefluss wird überschlägig aus Fläche, U-Wert, Heizgradstunden und Randtemperaturfaktor gerechnet. Der sichtbare Tirol-Fallback HGT 22/14 beträgt 3.500 Kd/a und ist überschreibbar.

```text
HGT_h = HGT_Kd × 24
Q_bestand = A × U_bestand × HGT_h × f_Rand / 1.000
Q_neu = A × U_neu × HGT_h × f_Rand / 1.000
ΔQ_Nutz = max(Q_bestand − Q_neu, 0)
ΔQ_End = ΔQ_Nutz / Nutzwärmefaktor
ΔK_Energie,a = ΔQ_End × Energiepreis
ΔCO₂_a = ΔQ_End × Emissionsfaktor
```

### Kosten

Dämmung:

```text
Vollkosten = Fläche × (Sockelkosten + Mehrkosten je cm × Dämmdicke)
Sowiesokosten = min(Vollkosten, Fläche × Sowiesokosten je m²), wenn Erneuerung ohnehin fällig
Energetische Mehrkosten = max(Vollkosten − Sowiesokosten, 0)
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

Förderung und Kostenbrücke:

```text
Förderung_%voll = Vollkosten × Fördersatz / 100
Förderung_%energetisch = energetische Mehrkosten × Fördersatz / 100
Förderung_Fix = Fixbetrag
Förderung_gesamt = begrenzt auf vorhandene Obergrenzen und höchstens Vollkosten
Bauteil-Quickcheck: Relevante Eigeninvestition = max(energetische Mehrkosten − Förderung_gesamt, 0)
Instandhaltung_a = Vollkosten × Instandhaltungssatz / 100
```

Hinweis: Diese Bauteil-Quickcheck-Kennzahl ist **nicht** identisch mit der wirtschaftlich zusätzlichen Investition des Wirtschaftlichkeitstools V0.4. Dort werden vollständige Referenz- und Sanierungsvarianten samt Erneuerungszeitpunkten verglichen und Förderungen können programmabhängig auch Begleitarbeiten umfassen.

### Dynamische Wirtschaftlichkeit

Der gemeinsame Kern kann Anfangsinvestition, Wiederbeschaffung, Restwert, Entsorgung, Energie, Instandhaltung, Preisentwicklung und Kalkulationszins berücksichtigen. Dargestellt werden Barwert-Gesamtkosten und dynamische Amortisation. Sensitivitätsanalysen sind bei langfristigen Annahmen empfohlen.

### Nutzungsdauer

Die Standarddatei unterscheidet informative Normwerte und transparent gekennzeichnete Projekt-Fallbacks. Jeder Wert bleibt überschreibbar und benötigt Quelle, Status und Datenstand.


## Wirtschaftlichkeit V0.4

### Grundprinzip

Das Tool vergleicht zwei vollständige Szenarien: Referenzzustand und Sanierungsvariante. Eine ohnehin zu erwartende Erneuerung wird zu ihrem erwarteten Zeitpunkt in der Referenz verbucht und nicht pauschal als heutige Sowiesokosten abgezogen.

Allgemeiner Barwert einer Zahlung `K` im Jahr `t`:

```text
P_m = 1 + p_m / 100
Q   = 1 + q / 100
BW  = K × (P_m / Q)^t
```

Der gemeinsame Kern berücksichtigt Anfangsinvestitionen, zeitlich verschobene Referenzinvestitionen, Wiederbeschaffungen, Restwerte, jährliche Energie-/Betriebskosten und kostenmindernde Positionen. Für die Kundengrafik wird die Kumulationsmethode verwendet; dadurch können mehrere Amortisations- und Deamortisationspunkte auftreten. Die sichtbare Hauptaussage verwendet nach Möglichkeit den Zeitpunkt, ab dem die Sanierungsvariante dauerhaft günstiger bleibt.

### Gemeinsame Finanzannahmen

`shared/data/economics/financial-defaults.json` enthält ab 12.08.2026 die gemeinsamen Defaults. Informative Vorschlagswerte aus ÖNORM M 7140 werden für Kalkulationszins, Energiepreisentwicklung, HKLS-Personal und haustechnische Anlagenteile getrennt von EAT-Projektentscheidungen gekennzeichnet. Der 30-jährige Betrachtungszeitraum bleibt eine EAT-Beratungsentscheidung.

### Kosten, Förderung und Referenz

- projektspezifisches Angebot > manuell bestätigter Projektwert > EAT-Richtkosten > Fallback,
- BKI nur interne Plausibilisierungsquelle, nicht öffentliche Laufzeit-Datentabelle; interner Regionalfaktor Tirol `1,019`,
- sichtbare Finanzierung (`Gesamtinvestition − mögliche Förderung`) und wirtschaftlich zusätzliche Investition werden getrennt ausgewiesen,
- **Kostenstruktur ≠ Förderbasis:** nominale Referenzarbeiten und energetische Verbesserung werden für die Beratung getrennt gezeigt; die Förderfähigkeit richtet sich aber nach dem jeweiligen Programm und kann beide nominalen Segmente umfassen,
- Förderung wird daher nicht auf die nominale energetische Mehrinvestition begrenzt. Sie kann bei einer förderfähigen thermischen Maßnahme auch Gerüst, Putz oder andere notwendige Begleitarbeiten mitfinanzieren,
- Förderungen werden vorsichtig als `bis zu` dargestellt und vor Umsetzung bei den Förderstellen verifiziert,
- die wirtschaftlich zusätzliche Investition wird als `Gesamtinvestition − Förderung − Barwert der Referenzerneuerungen` berechnet und **nicht auf 0 begrenzt**. Ein negativer Wert wird als wirtschaftlicher Startvorteil ausgewiesen.
- ist eine Referenz-Erneuerung kostenmäßig bekannt, ihr Zeitpunkt aber noch `offen`, bleibt der Kostenwert sichtbar, wird bis zur zeitlichen Klärung aber **nicht** als heutige Sowieso-Investition vom Vergleich abgezogen.

### Eigenständiger Schnellstart V0.4

Fehlen gespeicherte Maßnahmen aus `Bauteil & Sanierung`, kann Wirtschaftlichkeit selbst Vorschläge vorbereiten. Priorität der Datengrundlage:

1. gespeicherte objektspezifische Maßnahme bzw. Energiefluss,
2. gemeinsame Hüllfläche + Projekt-U-Wert + zentraler Ziel-U-Wert,
3. gemeinsame Hüllfläche + Bauperioden-U-Wert + Ziel-U-Wert,
4. Klima/HGT aus Projekt; falls nicht verfügbar vorläufiger Tirol-HGT-Fallback.

Der thermische Hüllstatus entscheidet, ob beispielsweise Dach oder oberste Geschoßdecke betrachtet wird. Automatisch abgeleitete Maßnahmeneinsparungen werden **nicht als statischer Projektwert eingefroren**, sondern bei besseren Projekt-, Klima- oder Hülldaten live neu berechnet. In sichtbaren Maßnahmenfeldern werden kWh-Werte auf 10 kWh/a gerundet; der Paketvergleich arbeitet mit den ungerundeten Rechenwerten. Nur ein bewusst gesetzter manueller Einsparungswert bleibt als Override gespeichert.

### Verbrauchsverankerte Einsparung V0.4

Die absolute Einsparung einer Hüllmaßnahme wird nicht mehr aus der Differenz einzelner `U × A × HGT`-Werte direkt vom realen Verbrauch abgezogen. Stattdessen werden Verbrauch und unabhängiges Hüllmodell bewusst verschränkt:

```text
Q_real,Raum,vor = E_Verbrauch × η − Q_Warmwasser
r_Hülle = Q_U,nach / Q_U,vor
Q_real,Raum,nach = Q_real,Raum,vor × r_Hülle
ΔQ_real = Q_real,Raum,vor − Q_real,Raum,nach
```

`Q_U,vor` und `Q_U,nach` stammen aus demselben unabhängigen Gebäude-/Hüllmodell wie der HWB aus U-Werten: vollständige thermische Hülle, Klima, Lüftung und Gewinne. Für ein Maßnahmenpaket wird **das gesamte Gebäude nach allen gewählten Hüllmaßnahmen neu gerechnet**; Einzelersparnisse werden nicht addiert.

Damit gilt als Beratungsprinzip:

> **Der reale Verbrauch bestimmt die Größenordnung. Die Gebäudephysik bestimmt die relative Wirkung.**

Ein anschließender Heizungstausch wird erst auf den nach der Hüllsanierung verbleibenden Nutzwärmebedarf angewendet. Warmwasser wird nur dann vom Heizenergieverbrauch getrennt, wenn es im Verbrauch enthalten ist; Personenzahl bzw. ein besserer Projektwert werden dafür aus der gemeinsamen Projektbasis verwendet.

Als Plausibilitätscheck werden der verbrauchsbasierte korrigierte HWB und der unabhängige HWB aus U-Werten gegenübergestellt. Große Abweichungen stoppen die Berechnung nicht, sondern erzeugen den Hinweis **„Hüllzustand prüfen“**. Mögliche Ursachen sind bereits sanierte Bauteile, von Bauperiodenwerten abweichende tatsächliche U-Werte, abweichende Beheizung/Nutzung, Warmwasserannahmen oder Klimadaten. Die aktuellen Hinweisstufen sind transparente EAT-Plausibilitätsregeln und keine normativen Grenzwerte.

### Zielbild Zukunftsfit 2050 · V0.4

Das Zielbild ist keine zusätzliche Kundeneingabe, sondern ein fachlicher Orientierungsrahmen. Es wird zweimal mit derselben Grafik gezeigt:

1. **Bestand heute**,
2. **mit gewählter Sanierung**.

Die Hülle wird aus den tatsächlich relevanten thermischen Hüllbauteilen und ihrem Verhältnis zu den zentralen Ziel-U-Werten abgeleitet. Ein komplett schlechter, aber bekannter Hüllzustand wird als `Sanierung nötig` und nicht als `teilweise` gewertet. Zwischenstufen sind `teilweise`, `weitgehend` und `zukunftsfit`. Technik bewertet grob Erneuerungsnähe/Zukunftsfähigkeit; `fossilfrei` und `PV` werden separat geführt. Ausgewählte Heizungs- bzw. PV-Maßnahmen verändern nur die **Sanierungsziel-Grafik**, nicht den Bestandsstatus.

### Förderdarstellung V0.4

Zusätzlich zum Anteil an der Gesamtinvestition wird der angenommene Förderbetrag orientierend auch ins Verhältnis zur **nominalen energetischen Investition** gesetzt. Dieser Prozentwert kann über 100 % liegen und ist dann kein Rechenfehler: Förderprogramme können Begleitarbeiten aus dem nominalen Referenzanteil als förderfähige Kosten anerkennen. Die Förderbasis bleibt daher weiterhin eine dritte, regelabhängige Ebene neben Kostenstruktur und Finanzierung.

### Manuelle Overrides V0.4

Vollkosten, Referenz-Erneuerung, Referenzzeitpunkt und Energieeinsparung können im Beratungsgespräch manuell überschrieben werden. Solche Eingriffe werden sichtbar als `manuell überschrieben` bzw. `manueller Override` gekennzeichnet. `↺ automatisch` entfernt nur den Override und stellt die aktuell beste automatische Ableitung wieder her; dadurch gehen neuere Projekt-, Klima- oder Kostendaten nicht verloren.

### Kundenergebnis V0.4

Der Hauptbereich zeigt Restinvestition, wirtschaftlich zusätzliche Investition bzw. Startvorteil, Energiekosten vorher/nachher samt jährlicher Einsparung und den dauerhaften wirtschaftlichen Schnittpunkt. Kundenbudget und gewählte Prioritäten werden im Ergebnis wieder aufgegriffen. Die Hauptgrafik zeigt den kumulierten Vorteil **gegenüber der Referenz**; die Nulllinie ist ausdrücklich „Referenz · beide Varianten gleich teuer“. Optional werden die kumulierten Lebenszykluskosten von Referenz und Sanierung als zwei Linien dargestellt.

`Barwertvorteil` wird in der Kundenoberfläche nicht als isolierter Fachbegriff verwendet, sondern als „über den Betrachtungszeitraum x € günstiger/teurer als die Referenz“.

### V0.4-Grenze

Die Oberfläche und der dynamische Rechenkern sind testbar. Die Förderengine ist noch nicht regelbasiert. Heizungsmaßnahmen erhalten einen ersten zentralen System-/Kostenansatz; PV-Kosten können berücksichtigt werden, das objektspezifische Ertrags-, Eigenverbrauchs- und Einspeisemodell ist in V0.4 noch nicht Teil des Lebenszyklusvergleichs.
