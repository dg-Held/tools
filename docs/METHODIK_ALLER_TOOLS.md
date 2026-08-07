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

Geschoßzahl und NFL sind die wichtigsten Prüfeingaben. Sie bleiben bei eingeklappter Detailtabelle in einer kompakten Zusammenfassung sichtbar. Aus `Grundfläche_verwendet = BGF / Geschoße` werden OGD, unterster Abschluss und Gebäudevolumen nachgeführt. Die Außenwand wird bei geänderter Grundfläche über die Quadratwurzel des Flächenverhältnisses skaliert; dadurch folgt der Umfang bei ähnlicher Gebäudeform plausibler als bei linearer Skalierung. Die Dachprojektion bleibt dagegen das amtliche TIRIS-Dachpolygon und wird nicht aus NFL oder BGF neu abgeleitet.

```text
Außenwand = TIRIS-Umfang × √(Grundfläche_verwendet / Dachprojektion) × Medianhöhe
Fenster = Außenwand × Fensteranteil
OGD = Kellerdecke = Grundfläche_verwendet
Dachschräge = TIRIS-Dachprojektion / cos(Dachneigung)
Gebäudevolumen = Grundfläche_verwendet × Medianhöhe
```

Der Fensteranteil ist als Beratungsregler von 10 bis 50 % voreingestellt auf 25 %. Die OIB-Richtlinie 3 fordert für Aufenthaltsräume eine Lichteintrittsfläche bezogen auf die Bodenfläche des jeweiligen Raums; daraus folgt kein allgemeiner gesetzlicher Mindestanteil an der gesamten Fassadenfläche.

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

Der Fensterflächenanteil ist im Energiefluss als gemeinsamer Regler von 10 bis 50 % sichtbar. Er bezieht sich auf die Brutto-Außenwand und führt – solange keine bewusst bestätigte Fensterfläche Vorrang hat – Fensterfläche, opake Außenwand und solare Gewinne gemeinsam nach. Beim bewussten Ändern des Reglers werden ältere manuelle Fenster-/opake Wandflächen verworfen, damit die neue Verhältnisannahme wirksam wird. Eine anschließend direkt eingegebene Fensterfläche wird wieder als genauerer Projektwert gespeichert.

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
```

Varianten werden intern genauer und sichtbar in 2-cm-Schritten gerechnet. Der frühere eigene Variantenblock entfällt; Mindeststandard, wirtschaftlicher Bereich und ambitionierte Variante werden direkt im Ergebnis gegenübergestellt.

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

Vorrangig wird der im Energiefluss kalibrierte Verlust des gewählten Bauteils verwendet. Fehlt er, wird mit Standortklima beziehungsweise dem transparenten HGT-Fallback gerechnet. Technische Korrekturen bleiben eingeklappt.

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

Kostenoptimum und kürzeste Amortisation verfolgen unterschiedliche Ziele und können bei verschiedenen Varianten liegen.

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
d_opt = λ × [√(HGT22/14 × 24 × c_N × F / (λ × 1.000 × c_V)) − R_0]
d_opt = max(d_opt, 0)
```

Die Formel ersetzt nicht den vollständigen Variantenvergleich und gilt nicht für erdberührte Bauteile.

### Automatische Maßnahmenpakete

Über einen eigenen, sichtbaren Schritt werden alle **für die thermische Hülle relevanten** und ausreichend vorbereiteten Bauteile gemeinsam ausgewertet. Der Relevanzstatus ist derselbe gemeinsame Projektwert, der im Energiefluss als „Aktiv“ geführt wird (`building.thermal.envelope.<bauteil>.enabled`). Im Bauteiltool kann er direkt beim geöffneten Bauteil geändert werden. Nicht relevante Bauteile bleiben im Projekt erhalten, werden aber weder für die automatische Hüllbilanz noch für automatische Maßnahmenpakete berücksichtigt.

Je relevantem Bauteil entstehen – soweit die Datengrundlage reicht – Entwürfe für:

- empfohlenen Mindeststandard,
- wirtschaftliche Variante,
- ambitionierte Variante.

Die Vorschläge werden unter `measures.auto-envelope-*` gespeichert. Jede Maßnahmenkarte speichert zusätzlich den Hüllstatus (`thermalEnvelope.relevant`) und den zugehörigen gemeinsamen Projektpfad. Drei Szenarien unter `scenarios.items.envelope-package-*` bündeln ausschließlich relevante Bauteile für das spätere Wirtschaftlichkeitstool. Automatisch erzeugte Einträge tragen `status = automatic-proposal` und `reviewStatus = not-reviewed`; vorhandene manuell gespeicherte Maßnahmen werden nicht überschrieben. Ändern sich Hüllstatus, Flächen, U-Werte, Klima-, Kosten- oder Finanzgrundlagen, markiert ein Fingerprint die Pakete als veraltet.

Technische Mindest- und ambitionierte Vorschläge können ohne Kostenrechnung entstehen. Für eine wirtschaftliche Variante werden zusätzlich Energiegrundlage, Kostenmodell, Nutzungsdauer, Energiepreis und Finanzannahmen benötigt.

### Komfort

Die innere Oberflächentemperatur wird überschlägig aus U-Wert, Innen- und Außentemperatur abgeleitet. Wärmebrücken und lokale Anschlüsse sind separat zu prüfen.

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

### Unabhängiger Hüllvergleich

Der Vergleich wird erst mit vorhandener Klimagrundlage berechnet. Die Schaltfläche zeigt, ob Klimawerte fehlen oder aktualisiert werden können.

```text
HGT = Vollbenutzungsstunden × (15 °C − NAT)
Q_Transmission = ΣUA × HGT / 1.000
Q_WB,rech = Q_Transmission × 0,075
Q_Raum,rech = max(Q_Transmission + Q_WB,rech + Q_Lüftung − Q_intern − Q_solar, 0)
HEB_rechnerisch = (Q_Raum,rech + Q_WW) / f_Nutz
HWB_U-Werte = Q_Raum,rech / BGF
Abweichung = (HEB_rechnerisch − HEB_eingegeben) / HEB_eingegeben × 100
```

Der **HWB aus U-Werten** und der **rechnerische Heizenergieverbrauch** sind voneinander zu unterscheiden: Der HWB bezieht sich auf die rechnerische Raumwärme je BGF, der Heizenergieverbrauch zusätzlich auf Warmwasser und den Nutzwärmefaktor. Der Vergleich dient der Plausibilisierung von Verbrauch, Hüllflächen und U-Werten. Er ersetzt weder Energieausweis noch normative Bedarfsberechnung.

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
