# Bauteil & Sanierung – Methodik und Berechnungsgrundlagen

**Stand:** 04.08.2026  
**Toolstand:** Arbeitsversion V0.2  
**Rechenkern:** `EnvelopeRenovationCore 0.2.0`  
**Wirtschaftlichkeitskern:** `EnergyEconomicsCore 1.0.0`

## 1. Zweck

Das Tool untersucht ein einzelnes Bauteil der thermischen Gebäudehülle. Energiefluss bleibt das Diagnosewerkzeug; Bauteil & Sanierung vergleicht technisch mögliche Sanierungsvarianten und deren Energie-, Kosten-, CO₂- und Komfortwirkung.

V0.2 unterstützt Außenwand, Dach/Dachschräge, oberste Geschoßdecke, Kellerdecke und Boden gegen Erdreich. Fenster und Türen folgen als diskrete Austauschvarianten.

## 2. Datenpriorität

```text
manuell bestätigt → amtlich → abgeleitet → Fallback
```

Fläche und Bestands-U-Wert werden aus dem gemeinsamen Projekt übernommen. Änderungen stehen danach auch im Energiefluss zur Verfügung.

## 3. U-Wert und Dämmdicke

Für eine homogene zusätzliche Dämmschicht gilt:

```text
U_neu = 1 / (1/U_Bestand + d/λ)
```

Die erforderliche Dicke für einen Ziel-U-Wert wird aus derselben Beziehung abgeleitet. Der konkrete Dämmstoff ist für diese thermische Berechnung nicht erforderlich; maßgeblich ist der λ-Wert. Ein eigener λ-Wert erscheint nur nach Auswahl „eigener Wert“.

## 4. Varianten und Rundung

Die Beratungstabelle zeigt 2-cm-Schritte. Das Kosten- und Amortisationsoptimum wird intern mit feineren Zwischenvarianten gesucht. Die Rechenwerte bleiben ungerundet; nur die Ausgabe wird vereinfacht:

- Dämmdicke: 2 cm,
- U-Wert: 2 Dezimalstellen,
- Richtpreise: 10 €/m²,
- Investitionssummen: 500 €,
- jährliche Kostenwirkung: 50 €/a,
- CO₂: 100 kg/a.

## 5. Energieeinsparung

### 5.1 Vorrang: kalibrierter Energiefluss

```text
Q_neu = Q_Bestand × U_neu / U_Bestand
```

Damit bleibt die Maßnahme an der verbrauchsbasierten Gebäudebilanz kalibriert.

### 5.2 Fallback: Standortklima

Ohne Energiefluss wird überschlägig mit Fläche, U-Wert und INCA-Heizgradstunden gerechnet. Die Temperaturkorrektur wirkt linear auf das Ergebnis. Ein Wert 0,5 halbiert den angesetzten Verlust gegenüber Außenluft. Deshalb bleibt diese Eingabe bei unbeheizten Bereichen und Erdreich sichtbar dokumentiert, ist aber standardmäßig eingeklappt.

### 5.3 HGT 22/14

HGT 22/14 wird ausschließlich für die ergänzende analytische Normorientierung nach Anhang B benötigt. Der aktuelle INCA-Rechenweg liefert andere Klimakennwerte und darf nicht kommentarlos in einen normativen HGT 22/14 umgerechnet werden. Ohne bestätigten HGT bleibt das Feld leer; der normale diskrete Variantenvergleich funktioniert trotzdem.

## 6. Empfehlungen und rechtliche Prüfung

Die Hauptdarstellung zeigt:

- Empfehlung,
- wirtschaftlichen Bereich,
- ambitionierten Standard.

Gesetzliche und förderbezogene Werte sind nur versionierte Warn- und Prüfdaten. Mindestanforderungen sind keine energetische Empfehlung. Eine möglicherweise unzureichende Variante muss vor Umsetzung projektspezifisch geprüft werden.

## 7. Kosten, Sowiesokosten und Förderung

```text
Vollkosten = Fläche × (Sockelkosten + variable Kosten je cm × Dämmdicke)
```

Bei ohnehin notwendiger Erneuerung werden Sowiesokosten abgezogen. Die Kostenbrücke lautet:

```text
Gesamtkosten
− Sowiesokosten
= energetische Mehrkosten
− bestätigte Landes-/Bundes-/sonstige Förderung
= relevante Eigeninvestition
```

Förderungen werden nicht automatisch vorgeschlagen. Sie können je Eintrag als Fixbetrag, Prozentsatz der Vollkosten oder Prozentsatz der energetischen Mehrkosten eingegeben werden. Das technische Kostenoptimum bleibt von Förderungen getrennt.

## 8. Dynamische Wirtschaftlichkeit

Der gemeinsame Wirtschaftlichkeitskern bildet Barwerte, Annuitäten, Wiederbeschaffung, Entsorgung, Restwerte, jährlich wiederkehrende Kosten und dynamische Amortisation ab. Das Kostenoptimum ist die Variante mit den geringsten Gesamtkosten über den Betrachtungszeitraum. Der wirtschaftliche Bereich umfasst derzeit Varianten höchstens 5 % über dem Minimum.

Kürzeste Amortisation und geringste Gesamtkosten können bei unterschiedlichen Dämmdicken liegen und werden getrennt ausgewiesen.

## 9. Analytische Normorientierung

Die vereinfachte optimale Dämmdicke nach dem informativen Anhang B der ÖNORM B 8110-4:2024 ist nur für geeignete opake Bauteile gegen Außenluft vorgesehen. Sie berücksichtigt unter anderem Förderungen, Instandhaltung, Entsorgung und komplexe Kostenmodelle nicht vollständig und ist nicht für erdberührte Bauteile geeignet. Der diskrete dynamische Variantenvergleich bleibt die Hauptmethode.

## 10. CO₂ und Wohnkomfort

Betriebliche CO₂-Einsparung:

```text
CO₂-Einsparung = Endenergieeinsparung × Emissionsfaktor
```

Die innere Oberflächentemperatur wird überschlägig aus U-Wert, Innen-/Grenztemperatur und innerem Wärmeübergangswiderstand berechnet. Wärmebrücken, Luftdichtheit, Feuchteschutz und Anschlussdetails sind separat zu prüfen.

## 11. Ausdruck

Der auf der Bildschirmseite unsichtbare Block `renovationPrintReport` ist ausschließlich der kompakte Druckbericht. Er wird erst im Druckmodus eingeblendet. Die sichtbare Ergebnisdarstellung dient als Grundlage für den Ausdruck, wird aber nicht doppelt auf dem Bildschirm angezeigt.

## 12. Aussagegrenzen

Beratungshilfe, kein Energieausweis, keine Ausführungsplanung, Förderzusage oder Rechtsauskunft. Ergebnisse hängen wesentlich von Kosten, Nutzungsdauer, Zinssatz, Preisentwicklung, Energiepreis und Ausgangslage ab. Sensitivitäten, Quellen und Datenstände sind im endgültigen Bericht zu dokumentieren.


## Ergänzungen V0.3

### Eigenständiger Standortzugang
Die Adresse kann direkt im Tool gewählt werden. Adressauflösung und TIRIS-Gebäudezuordnung verwenden
die gemeinsamen Services der Toolsammlung. Manuelle Projektwerte werden durch eine neue amtliche
Geometrie nicht überschrieben.

### HGT-Fallback
Wenn kein projektspezifischer HGT-22/14-Wert vorliegt, wird für die zusätzliche analytische Orientierung
ein sichtbarer Fallback von 3.500 Kd/a verwendet. Der normale Variantenvergleich verwendet vorrangig
den aus dem Energiefluss übernommenen Bauteilverlust oder die gemeinsame Standortklimaberechnung.

### Diagramme
Das Gesamtkostendiagramm sucht die niedrigsten Barwert-Gesamtkosten über den Betrachtungszeitraum.
Die dynamische Amortisation sucht den Zeitpunkt des Kostenausgleichs. Beide Kennwerte verfolgen
unterschiedliche Ziele und können bei unterschiedlichen Varianten liegen.

### Infografik
Die Infografik verwendet ausschließlich bereits berechnete Ergebnisse. Sie rechnet keine zusätzlichen
Kennwerte und zeigt bewusst gerundete Energie-, Kosten-, CO2- und Komfortwirkungen.
