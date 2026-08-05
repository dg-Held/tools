# Bauteil & Sanierung – Methodik und Berechnungsgrundlagen

**Stand:** 05.08.2026  
**Toolstand:** Arbeitsversion V0.5  
**Maßnahmenkern:** `EnvelopeRenovationCore 0.5.0`  
**Wirtschaftlichkeitskern:** `EnergyEconomicsCore 1.0.0`

## 1. Zweck und Abgrenzung

Das Tool untersucht ein einzelnes Bauteil der thermischen Gebäudehülle. Energiefluss bleibt das Diagnosewerkzeug; Bauteil & Sanierung vergleicht technisch mögliche Sanierungsvarianten und deren Energie-, Kosten-, CO₂- und Komfortwirkung.

Unterstützt werden:

- Außenwand,
- Dach/Dachschräge,
- oberste Geschoßdecke,
- Kellerdecke,
- Boden gegen Erdreich,
- Fenster,
- Haustür/Außentür.

## 2. Eigenständigkeit und gemeinsame Projektbasis

Das Tool kann direkt über die Toolübersicht oder aus Energiefluss V4 geöffnet werden. Adresse, TIRIS-Geometrie, Fläche, Bestands-U-Wert, Klimadaten, Energieträger und ein vorhandener Bauteilverlust werden aus dem gemeinsamen Projekt übernommen. Manuell bestätigte Werte haben Vorrang.

```text
manuell bestätigt → amtlich → abgeleitet → Fallback
```

## 3. Zwei Maßnahmenarten

### 3.1 Dämmmaßnahmen

Für eine homogene zusätzliche Dämmschicht gilt:

```text
U_neu = 1 / (1/U_Bestand + d/λ)
```

Die erforderliche Dicke für einen Ziel-U-Wert wird aus derselben Beziehung abgeleitet. Die Beratungstabelle verwendet 2-cm-Schritte; das wirtschaftliche Optimum wird intern feiner untersucht.

### 3.2 Austauschmaßnahmen Fenster und Türen

Fenster und Türen werden als diskrete Varianten mit festgelegtem U-Wert und zugeordneter Richtkostenstufe verglichen:

- Basis-Austausch,
- empfohlener Mindeststandard,
- ambitionierte Variante.

Eine kontinuierliche Dämmdickenberechnung und ein λ-Wert sind bei Fenstern und Türen nicht anwendbar. Fensterkosten werden über die Fensterfläche, Haustürkosten über die Stückzahl berechnet; die Energieeinsparung bleibt auch bei der Tür flächenbezogen.

## 4. Baujahr und empfohlener Mindeststandard

Wenn kein besserer Bestands-U-Wert vorhanden ist, kann das Jahr der Baubewilligung einen sichtbaren Vorschlag aus der gemeinsamen Baujahrestabelle liefern. Der Vorschlag bleibt eine Beratungsannahme; ein manuell bestätigter U-Wert hat Vorrang. Ohne gültigen Bestands-U-Wert wird keine Berechnung durchgeführt.

### Empfohlener Mindeststandard

Der **empfohlene Mindeststandard** ist die untere Grenze der fachlichen Beratungsempfehlung. Er ist ausdrücklich kein gesetzlicher Mindestwert. Das Tool stellt daneben den wirtschaftlichen Bereich beziehungsweise das Kostenoptimum und einen ambitionierten Standard dar.

Rechtliche und förderbezogene Anforderungen bleiben versionierte Prüfwerte. Eine Variante, die hinterlegte Anforderungen möglicherweise unterschreitet, muss vor Umsetzung projektbezogen geprüft werden.

## 5. Rechengenauigkeit und Darstellung

Intern wird mit voller Rechengenauigkeit gearbeitet. Angezeigt werden bewusst gerundete Werte:

- Dämmdicke: 2-cm-Schritte,
- U-Wert: zwei Dezimalstellen,
- Richtpreis: 10 €/m²,
- Investitionssumme: 500 €,
- jährliche Kostenwirkung: 50 €/a,
- CO₂-Wirkung: 100 kg/a.

Die Rundung dient der verständlichen Beratung und verhindert Scheingenauigkeit. Wirtschaftliche Auswahl und Vergleich erfolgen mit ungerundeten Rechenwerten.

## 6. Energieeinsparung

### 6.1 Vorrang: kalibrierter Energiefluss

Wenn Energiefluss V4 einen Bauteilverlust bereitstellt:

```text
Q_neu = Q_Bestand × U_neu / U_Bestand
```

### 6.2 Fallback: Klima, Fläche und U-Wert

Ohne kalibrierten Bauteilverlust wird überschlägig gerechnet:

```text
Q = A × U × Heizgradstunden × Temperaturkorrektur
```

Der sichtbare Tirol-Fallback für HGT 22/14 beträgt 3.500 Kd/a. Er ist ein überschreibbarer Beratungsfallback und kein adressscharfer Normwert.

Die Temperaturkorrektur ist nur bei der Fallbackberechnung wirksam. Bei Bauteilen gegen unbeheizte Räume oder Erdreich kann der Unterschied gegenüber Außenluft erheblich sein.

## 7. Kosten und Sowiesokosten

### 7.1 Dämmmaßnahmen

```text
Vollkosten = Fläche × (Sockelkosten + Mehrkosten je cm × Dämmdicke)
```

### 7.2 Fenster und Türen

```text
Fenster: Vollkosten = Fensterfläche × Richtpreis der Austauschvariante
Haustür: Vollkosten = Anzahl × Richtpreis der Austauschvariante
```

Bei ohnehin notwendiger Erneuerung wird die Referenzmaßnahme mit Sowiesokosten angesetzt. Bei Fenster und Haustür bildet der Basis-Austausch die wirtschaftliche Vergleichsvariante; der energetische und finanzielle Zusatznutzen höherer Qualitätsstufen wird gegenüber diesem Basis-Austausch beurteilt:

```text
Gesamtkosten
− Sowiesokosten
= energetische Mehrkosten
− bestätigte Förderung
= relevante Eigeninvestition
```

## 8. Förderung

Förderungen werden nicht automatisch vorgeschlagen. Die Beraterin oder der Berater kann projektbezogen eintragen:

- Landesförderung,
- Bundesförderung,
- sonstige Förderung.

Je Position sind Fixbetrag, Prozent der Vollkosten oder Prozent der energetischen Mehrkosten möglich. Nur bestätigte Eingaben werden berücksichtigt. Das technische Kostenoptimum bleibt von der Förderung getrennt.

## 9. Nutzungsdauer und Instandhaltung Austauschbauteile

Der informative Anhang D der ÖNORM EN 15459-1:2017 liefert für die aktivierten Fensterarten:

| Fensterart | Nutzungsdauer | jährliche Instandhaltung |
|---|---:|---:|
| Holzrahmen | 30 Jahre | 1,0 % der Anfangsinvestition |
| Aluminiumrahmen | 30 Jahre | 0,5 % der Anfangsinvestition |

Diese Werte sind informative Richtwerte. Kunststoff und Holz-Aluminium verwenden mangels eindeutigem Eintrag transparente Projekt-Fallbacks. Für Haustüren liegt im bereitgestellten Auszug kein direkt zuordenbarer Eintrag vor; die Nutzungsdauer bleibt daher überschreibbarer Projekt-Fallback. Nationale Anhänge, projektspezifische Angaben oder bessere dokumentierte Werte können alle Vorschläge ersetzen.

Für die opaken Dämmmaßnahmen enthielt der bereitgestellte Auszug keine direkt zuordenbaren Datensätze. Die dort verwendeten Nutzungsdauern bleiben deshalb transparente, überschreibbare Projekt-Fallbacks.

## 10. Dynamische Wirtschaftlichkeit

Der gemeinsame Wirtschaftlichkeitskern berücksichtigt je nach vorhandenen Eingangsdaten:

- Anfangsinvestition,
- Wiederbeschaffung,
- Restwert,
- Entsorgung,
- jährlich wiederkehrende Energiekosten,
- Instandhaltung,
- Preisentwicklungsraten,
- Kalkulationszins,
- Barwert-Gesamtkosten,
- dynamische Amortisation.

Das Kostenoptimum ist die Variante mit den geringsten Gesamtkosten über den Betrachtungszeitraum. Die kürzeste Amortisation beantwortet dagegen, wann sich die Mehrinvestition rechnerisch ausgleicht. Beide Ziele können zu unterschiedlichen Varianten führen.

## 11. CO₂ und Wohnkomfort

```text
CO₂-Einsparung = Endenergieeinsparung × Emissionsfaktor
```

Die innere Oberflächentemperatur wird überschlägig aus U-Wert, Innen-/Grenztemperatur und innerem Wärmeübergangswiderstand berechnet. Die Grafik „Sanierung auf einen Blick“ stellt Bestand und ausgewählte Variante gegenüber.

Wärmebrücken, Luftdichtheit, Feuchteschutz, Montagefugen, Rahmenanteile und Anschlussdetails sind separat zu prüfen.

## 12. Gemeinsame BGF-Volumen-Ableitung

Ein automatisch abgeleitetes Gebäudevolumen wird projektweit aus verwendeter BGF, verwendeter Geschoßzahl und Medianhöhe nachgeführt. Fehlt die Medianhöhe, wird das Höhenmodul verwendet. Ein manuell bestätigtes Volumen behält immer Vorrang.

## 13. Optionale SVG-Grafiken

Eigene Grafiken können unter

```text
assets/svg/tools/bauteil-sanierung/
```

abgelegt werden. Fehlt eine Datei, bleibt die integrierte Fallback-Grafik sichtbar. Geladene SVGs werden auch in den Druckbericht übernommen. Die Namen stehen in der dortigen `README.md`.

## 14. Ausdruck

Der Druckbericht zeigt kompakt:

- Projekt und Bauteil,
- Ausgangslage,
- „Sanierung auf einen Blick“ mit Gesamtkosten und Amortisation,
- Kostenbrücke,
- Wirtschaftlichkeitsdiagramme,
- drei Orientierungspunkte,
- Grundlagen und Grenzen.

Die vollständige Tabelle „Alle Varianten vergleichen“ wird bewusst nicht gedruckt.

## 15. Aussagegrenzen

Beratungshilfe, kein Energieausweis, keine Ausführungsplanung, Förderzusage oder Rechtsauskunft. Ergebnisse hängen wesentlich von Kosten, Nutzungsdauer, Instandhaltung, Zinssatz, Preisentwicklung, Energiepreis und Ausgangslage ab. Quellen, Datenstände und projektspezifische Abweichungen sind zu dokumentieren.
