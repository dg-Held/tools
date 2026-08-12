# Normvalidierung – ÖNORM B 8110-4:2024-04-15

**Stand:** 12.08.2026  
**Rechenkern:** `shared/js/domain/economics/economics-core.js`  
**Core-Version:** 1.1.0

## 1. Quelle und Nutzungsgrenze

Grundlage ist die vom Nutzer bereitgestellte vollständige ÖNORM B 8110-4, Ausgabe 2024-04-15. Die Normdatei selbst wird aus lizenzrechtlichen Gründen **nicht** in das Website- oder Änderungspaket übernommen.

Die Norm gilt für die betriebswirtschaftliche Bewertung des Wärmeschutzes von Bauteilen und Gebäuden. Gebäudetechnische Anlagen sind nicht Gegenstand; hierfür verweist die Norm auf ÖNORM M 7140.

## 2. Umgesetzte Verfahren

Der gemeinsame Rechenkern enthält:

- Preisentwicklungs- und Zinsfaktoren
- allgemeinen Barwert
- Anfangsinvestitionskosten
- Wiederbeschaffungskosten
- jährlich wiederkehrende Kosten
- Entsorgungskosten einschließlich anteiligem Ansatz am Ende des Betrachtungszeitraums
- Restwerte
- Gesamtkosten nach Kostengruppen
- Annuität
- Gesamtkostenverlauf
- Amortisationsdauer nach Durchschnittsmethode
- Amortisations- und Deamortisationsdauern nach Kumulationsmethode
- vereinfachte wirtschaftlich optimale Dicke opaker Bauteile gemäß Anhang B

Die laufenden verbrauchs- und betriebsgebundenen Kosten werden nachschüssig am Ende jedes Berechnungsjahres berücksichtigt.

Seit Core-Version 1.1.0 unterstützt derselbe gemeinsame Rechenkern zusätzlich zeitlich versetzte Referenzinvestitionen und einen späteren Start von Komponenten-Lebenszyklen. Diese Erweiterung dient insbesondere dem Wirtschaftlichkeitstool; die validierten Berechnungsergebnisse nach ÖNORM B 8110-4 bleiben unverändert. Die vollständige Regression wurde am 12.08.2026 erneut erfolgreich ausgeführt.

## 3. Kostenstruktur

Die Software trennt:

- kapitalgebundene Kosten
- verbrauchsgebundene Kosten
- betriebsgebundene Kosten
- kostenmindernde Positionen

Förderungen werden der jeweiligen Kostengruppe zugeordnet und nicht pauschal nachträglich von einem beliebigen Ergebnis abgezogen.

## 4. Validierung nach normativem Anhang A

Die Norm verlangt, dass ein Computerprogramm das Verfahren korrekt abbildet und die Ergebnisse des Validierungsbeispiels zumindest bis zur zweiten Nachkommastelle ident ermittelt.

| Prüfwert | Norm | Core | Ergebnis |
|---|---:|---:|---|
| Differenz Anfangsinvestition | 3.570,0000 € | 3.570,0000 € | bestanden |
| Barwert Entsorgung | 206,5301 € | 206,5301 € | bestanden |
| Summe Variante 1 | 3.776,5301 € | 3.776,5301 € | bestanden |
| Barwert Verbrauch Variante 2 | 8.017,6522 € | 8.017,6522 € | bestanden |
| Gesamtkostendifferenz | 4.241,1221 € | 4.241,1221 € | bestanden |
| Annuität Variante 1 | 150,4427 € | 150,4427 € | bestanden |
| Annuität Variante 2 | 319,3931 € | 319,3931 € | bestanden |
| Amortisation Durchschnittsmethode | 19,8128 a | 19,8128 a | bestanden |
| Amortisation Kumulationsmethode | 18,7772 a | 18,7772 a | bestanden |

Die Amortisationszeit wird numerisch auf Jahresbasis bestimmt und zwischen den beiden umschließenden Jahreswerten linear interpoliert. Dadurch werden die Werte des Normbeispiels bis zur vierten Nachkommastelle reproduziert.

Maschinenlesbarer Prüfbericht:

```text
docs/NORMVALIDIERUNG-OENORM-B-8110-4-2024.json
```

Ausführbarer Test:

```text
node tests/validate-oenorm-b8110-4.js
```

## 5. Validierung des informativen Anhangs B

### Beispiel B1 – Betonwand mit EPS

| Prüfwert | Norm | Core |
|---|---:|---:|
| Nutzenergiepreis | 0,1000 €/kWh | 0,1000 €/kWh |
| Verzinsungsfaktor Energiekosten | 61,5489 | 61,5489 |
| Basis-Wärmedurchlasswiderstand | 0,2570 m²K/W | 0,2570 m²K/W |
| optimale Dicke | 0,4050 m | 0,4050 m |

### Beispiel B2 – Ziegelmauerwerk mit Holzfaser

| Prüfwert | Norm | Core |
|---|---:|---:|
| Nutzenergiepreis | 0,1429 €/kWh | 0,1429 €/kWh |
| Verzinsungsfaktor Energiekosten | 61,5489 | 61,5489 |
| Basis-Wärmedurchlasswiderstand | 1,2315 m²K/W | 1,2315 m²K/W |
| optimale Dicke | 0,2232 m | 0,2232 m |

## 6. Wichtige fachliche Folgerungen

### 6.1 Hauptmethode ist der vollständige Variantenvergleich

Das betriebswirtschaftliche Optimum liegt dort, wo die Gesamtkosten über den Betrachtungszeitraum ein Minimum bilden. Für die Kundenberatung wird daher der vollständige dynamische Variantenvergleich als Hauptmethode verwendet.

### 6.2 Anhang B ist nur eine vereinfachte Zusatzorientierung

Die analytische Formel des Anhangs B berücksichtigt keine Förderung, Instandhaltung, Entsorgung, Geometrieänderung oder abgestufte Energiekosten. Sie ist nicht für erdberührte Bauteile anwendbar. Deshalb darf sie nicht allein die Empfehlung bestimmen.

### 6.3 Bestands-U-Wert und Widerstand

Wenn der vollständige Bestands-U-Wert als Ausgangswert eingegeben wird, ist für eine zusätzliche homogene Dämmschicht der vorhandene Gesamtwiderstand:

```text
R_Bestand = 1 / U_Bestand
```

Die inneren und äußeren Wärmeübergangswiderstände werden dann nicht nochmals abgezogen oder addiert. Liegt stattdessen nur der Widerstand der Materialschichten vor, müssen die Wärmeübergangswiderstände gemäß dem gewählten Bauteil ergänzt werden.

### 6.4 HGT22/14

Die vereinfachte Optimierung benötigt Heizgradtage `HGT22/14`. Das spätere Tool muss diesen Kennwert aus der gemeinsamen Klimabasis bereitstellen. Der heutige INCA-Plausibilitätsvergleich des Energieflusses verwendet eine andere Bilanzlogik und darf nicht unbesehen eingesetzt werden.

### 6.5 Vergleichbarkeit

Zu vergleichende Bauteile müssen denselben Zweck erfüllen und in ihrem Leistungsumfang vergleichbar sein. Für Sowiesokosten sind daher zwei nachvollziehbare Vergleiche zu unterscheiden:

- Bestand gegen vollständige Sanierungsmaßnahme
- ohnehin erforderliche Erneuerung gegen energetisch verbesserte Erneuerung

### 6.6 Bericht und Quellen

Alle Eingangsdaten, Festlegungen, Quellen, Kostenpositionen, Nutzungsdauern und Berechnungsergebnisse werden im Bericht dokumentiert. Ergebnisse werden mindestens ganzzahlig ausgegeben; intern rechnet der Core mit höherer Genauigkeit.

### 6.7 Sensitivität

Eine Sensitivitätsanalyse ist fachlich vorgesehen. Für das neue Tool werden mindestens Energiepreis/-entwicklung, Zinssatz und Investitionskosten variiert.

## 7. Status

Der gemeinsame Wirtschaftlichkeitskern bildet die für das Fachkonzept benötigten Verfahren ab und besteht die mitgelieferten Validierungsfälle. Vor der Bezeichnung einer fertigen Benutzeroberfläche als „Berechnung gemäß ÖNORM B 8110-4“ müssen zusätzlich Eingabeführung, Bericht, Quellenpflicht, Sensitivität und alle verwendeten Kostenmodelle vollständig umgesetzt und getestet sein.

## 8. Abgleich mit den vorhandenen Exceldateien

Die Datei `Wirtschaftlichkeit von Wärmedämmung nach Norm.xlsm` enthält bereits wesentliche richtige Grundideen:

- Barwertfaktor für steigende Energiekosten
- Nutzenergiepreis aus Endenergiepreis und Jahresnutzungsgrad
- Kostenkurve über die Dämmdicke
- Gegenüberstellung Kostenoptimum und kürzeste Amortisation
- Fixkosten plus variable Kosten je zusätzlichem Zentimeter

Für den neuen Stand sind folgende Punkte zu korrigieren beziehungsweise zu erweitern:

1. Der informative Anhang B verwendet `HGT22/14`, nicht `HGT20/12`.
2. Wenn ein vollständiger Bestands-U-Wert eingegeben wird, gilt `R_Bestand = 1/U_Bestand`; `Rsi` und `Rse` dürfen nicht nochmals abgezogen werden.
3. Die Ausgabe 2024 verlangt für die vollständige dynamische Rechnung auch Wiederbeschaffung, Entsorgung, Restwerte und getrennte Kostengruppen.
4. Laufende Kosten werden nachschüssig am Ende jedes Berechnungsjahres angesetzt.
5. Durchschnitts- und Kumulationsmethode sind getrennt darzustellen.
6. Förderung ist kostenmindernde Position der jeweiligen Kostengruppe.
7. Sensitivitätsanalyse, Quellenangaben und Bericht sind Teil der vollständigen Umsetzung.
8. Die vereinfachte analytische Dämmdicke darf nicht für erdberührte Bauteile verwendet werden.

Die Datei `Wirtschaftlichkeitstool MP V2.xlsx` bleibt eine wertvolle Vorlage für die kundenfreundliche Darstellung von Sowiesokosten, Förderung, CO₂ und Varianten. Ihre Formeln werden jedoch nicht ungeprüft als normativer Rechenkern übernommen.
