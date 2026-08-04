# Fachkonzept V1 – Bauteil & Sanierung

**Stand:** 04.08.2026  
**Status:** verbindliche Grundlage vor der Programmierung  
**Arbeitstitel:** Bauteil & Sanierung  
**Untertitel:** Dämmstandard, Wirtschaftlichkeit und Wohnkomfort

## 1. Grundentscheidung

Die Bauteiloptimierung wird als **eigenständiges Tool** umgesetzt. Energiefluss bleibt das Diagnosewerkzeug und beantwortet: „Wo gehen Energie und Wärme verloren?“ Das neue Tool beantwortet: „Wie weit sollte dieses konkrete Bauteil verbessert werden?“

Beide Werkzeuge verwenden dieselben Projektwerte und Rechenkerne. Energiefluss erhält später je Bauteil einen direkten Einstieg; die Maßnahme wird nicht doppelt angelegt.

## 2. Abgrenzung der Werkzeuge

| Werkzeug | Hauptfrage |
|---|---|
| Energiefluss | Welche Bereiche verursachen wie viel Verlust? |
| Bauteil & Sanierung | Welcher Sanierungsstandard ist technisch, wirtschaftlich und langfristig sinnvoll? |
| Wirtschaftlichkeit | Wie schneiden alle gespeicherten Maßnahmen und Pakete im Vergleich ab? |
| Sanierungsfahrplan | In welcher Reihenfolge werden die Maßnahmen umgesetzt? |

## 3. Umfang V1

### 3.1 Dämmmaßnahmen

- Außenwand gegen Außenluft
- Dach / Dachschräge gegen Außenluft
- oberste Geschoßdecke gegen unbeheizten Dachraum
- Kellerdecke / Decke gegen unbeheizten Gebäudeteil
- Boden gegen Erdreich
- erdberührte Wand

### 3.2 Austauschmaßnahmen

- Fenster und Fenstertüren
- Außentüren

Dämmmaßnahmen verwenden kontinuierliche Dickenvarianten. Fenster und Türen werden als diskrete Produkt-/U-Wert-Varianten verglichen.

## 4. Haustechnik wird im Datenmodell berücksichtigt, aber nicht in diesem Tool berechnet

Das gemeinsame Maßnahmenmodell muss bereits folgende Gruppen unterstützen:

```text
Gebäudehülle
Wärmeerzeugung
Wärmeverteilung und Wärmeabgabe
Lüftung und Raumluft
Strom und Solar
```

Heizungstausch, Rohrleitungsdämmung, hydraulischer Abgleich, Heizkörper, Flächenheizung, Regelung und Lüftungsanlagen gehören später in eigene fachliche Oberflächen. Ihre Wirtschaftlichkeit ist mit ÖNORM M 7140 beziehungsweise den dafür maßgeblichen Verfahren zu bewerten. Das Bauteiltool bleibt auf den Wärmeschutz der Hülle fokussiert.

## 5. Bedienablauf

### Schritt 1 – Bauteil auswählen

Bei Einstieg aus Energiefluss sind Bauteil, Fläche, Bestands-U-Wert, Projekt und Klima bereits vorausgefüllt. Beim eigenständigen Start werden nur Bauteil, Fläche und Bestands-U-Wert benötigt; alle anderen Angaben erhalten sichtbare Vorschläge.

### Schritt 2 – Bestand kompakt prüfen

Beispiel:

```text
Außenwand
Fläche                 280 m²
U-Wert Bestand         1,20 W/m²K
Herkunft               manuell bestätigt
Bauperiode             1960–1981
Anteil Hüllverlust     43 %
```

Pflichteingaben:

- Bauteil
- Fläche
- Bestands-U-Wert

Bauperiode und typischer Aufbau dienen nur der Plausibilisierung. Konkrete U-Werte haben Vorrang.

### Schritt 3 – Ziel und Varianten

In der Hauptbedienung werden nur verwendet:

- Bestands-U-Wert
- Wärmeleitfähigkeit λ
- automatisch erzeugte Dämmstärken beziehungsweise Austauschvarianten

Ein konkreter Dämmstoff ist für die thermische Grundrechnung nicht erforderlich. Eine optionale Material-/Ökologievertiefung kann später ergänzt werden.

Für Dämmungen wird beispielsweise gerechnet:

```text
0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28 cm
```

Für jede Variante werden U-Wert, Energie, Kosten, CO₂, Komfort und Wirtschaftlichkeit berechnet.

## 6. Keine prominente Karte „Mindestanforderung“

Gesetzliche und förderbezogene Grenzwerte werden versioniert als **Prüfhinweis im Hintergrund** geführt. Sie sind keine Beratungsempfehlung und werden nicht als attraktive Zielkarte präsentiert.

Sichtbarer Hinweis:

> Gesetzliche Mindestanforderungen sind keine energetische Empfehlung. Bei einer langlebigen Sanierung sind Behaglichkeit, Sowiesokosten, Energieeinsparung, Lebensdauer und zukünftige Anforderungen mitzuberücksichtigen.

Wählt der Nutzer eine potenziell unzureichende Variante, erscheint:

> ⚠ Die gewählte Variante könnte aktuelle baurechtliche oder förderbezogene Anforderungen unterschreiten. Vor Umsetzung ist der aktuelle, projektspezifische Stand zu prüfen.

## 7. Ergebnis für das Beratungsgespräch

Die Hauptdarstellung bleibt auf drei Ergebnisbereiche begrenzt:

### Empfehlung

Fachlich sinnvoller Zielbereich aus der zentralen Empfehlungstabelle.

### Wirtschaftlicher Bereich

- niedrigste Gesamtkosten über den Betrachtungszeitraum
- kürzeste dynamische Amortisationsdauer
- wirtschaftlicher Dicken-/Variantenbereich

Kostenoptimum und Amortisationsoptimum dürfen unterschiedlich sein und werden ausdrücklich nebeneinander gezeigt.

### Ambitioniert

Langfristig sehr guter Wärmeschutz mit zusätzlicher Energie-, CO₂- und Komfortwirkung.

## 8. Diagramme

### Hauptdiagramm – Gesamtkosten

Gesamtkosten/Barwerte über Dämmstärke oder Produktvariante mit Markierungen für:

- Empfehlung
- Kostenoptimum
- ambitionierte Variante

### Zusatzdiagramm – Amortisationsdauer

Separate Darstellung der dynamischen Amortisationsdauer. Keine gemeinsame Achse mit Euro-Werten.

### Sensitivität

Mindestens Energiepreis beziehungsweise Energiepreisentwicklung, Zinssatz und Investitionskosten werden als Bandbreite geprüft.

## 9. Vollständige dynamische Wirtschaftlichkeitsrechnung als Hauptmethode

Die Hauptbewertung vergleicht diskrete Varianten über den Betrachtungszeitraum und berücksichtigt:

- Anfangsinvestitionskosten
- Wiederbeschaffungskosten
- Entsorgungskosten
- Restwerte
- verbrauchsgebundene Kosten
- betriebsgebundene Kosten
- Förderungen und weitere kostenmindernde Positionen
- unterschiedliche Preisentwicklungsraten
- kalkulatorischen Zinssatz
- Umsatzsteuer ein/aus

Ergebnisse:

- Barwerte der Kostengruppen
- Gesamtkosten
- Annuität
- Amortisationsdauer nach Durchschnittsmethode
- Amortisations- und gegebenenfalls Deamortisationsdauer nach Kumulationsmethode
- Gesamtkostenverlauf
- Sensitivitätsanalyse

## 10. Vereinfachtes analytisches Kostenoptimum

Die vereinfachte optimale Dämmdicke gemäß informativem Anhang B der ÖNORM B 8110-4 wird als zusätzliche Orientierung angeboten, aber nicht als alleinige Kundenempfehlung.

Zulässig nur für:

- opake Bauteile gegen Außenluft
- eine einzelne veränderbare wärmeschutztechnisch wirksame Schicht

Nicht anzuwenden für:

- erdberührte Bauteile
- Fenster und Türen
- Fälle, in denen Förderungen, Instandhaltung, Entsorgung, Geometrieänderungen oder komplexe Kostenmodelle entscheidend sind

Für die Anwendung wird `HGT22/14` benötigt. Dieser Klimakennwert wird später aus dem gemeinsamen Klimadienst bereitgestellt und darf nicht durch den heutigen Energiefluss-Plausibilitätswert ersetzt werden.

## 11. Sowiesokosten

Sowiesokosten werden leicht verständlich als Kostenbrücke dargestellt:

```text
Gesamtkosten der Maßnahme
− ohnehin anstehende Erneuerungskosten
= energetische Mehrkosten
− bestätigte Förderung
= relevante Eigeninvestition
```

Der Nutzer wählt:

- rein energetische Maßnahme
- Sanierung/Erneuerung ohnehin erforderlich
- Ausgangslage unbekannt

Das Kostenmodell schlägt Sowiesokosten vor; der Berater kann sie überschreiben.

Es werden zwei wirtschaftliche Sichten ausgewiesen:

1. Vollkosten der gesamten Maßnahme
2. energetische Mehrkosten gegenüber der ohnehin notwendigen Erneuerung

## 12. Förderung

Förderung wird nie automatisch und unbemerkt eingerechnet.

Mögliche Eingaben:

- keine Förderung berücksichtigt
- Betrag
- Prozentsatz
- bestätigt / nur mögliche Förderung
- Quelle und Datenstand

Das technische Kostenoptimum wird zusätzlich **ohne Förderung** ausgewiesen, damit zeitlich begrenzte Förderungen die bautechnische Empfehlung nicht verzerren.

## 13. CO₂

V1 zeigt klar getrennt:

- jährliche betriebliche CO₂-Einsparung
- kumulierte betriebliche CO₂-Einsparung im Betrachtungszeitraum

Graue Emissionen und ökologische Amortisation werden erst ergänzt, wenn belastbare Materialdaten vorliegen. Sie dürfen nicht mit betrieblichem CO₂ vermischt werden.

## 14. Wohnkomfort

Als greifbarer Zusatznutzen wird die überschlägige innere Oberflächentemperatur vor und nach Sanierung dargestellt.

Zusätzliche Hinweise:

- geringere Strahlungsasymmetrie
- weniger Kaltluftabfall und Zuggefühl
- verbesserte Behaglichkeit
- geringeres Oberflächenkondensatrisiko

Wärmebrücken und lokale Anschlussdetails bleiben separat zu prüfen.

## 15. Gemeinsames Maßnahmenobjekt

Eine Maßnahme wird nur einmal gespeichert, beispielsweise:

```text
id
type / category
componentId
existingState
selectedVariant
targetProfile
energyEffect
costModel
sunkCosts
subsidy
financialAssumptions
economicsResult
co2Effect
comfortEffect
qualityImpacts
dependencies
comments
sourceVersions
```

Energiefluss, Wirtschaftlichkeit und Sanierungsfahrplan greifen auf dieses Objekt zu. Ergebnisse werden aus Eingaben und Datenversionen neu berechnet; ein Berichtssnapshot dokumentiert den damaligen Stand.

## 16. Wartbare Daten

Die spätere Excel-Masterdatei wird getrennte Blätter für folgende Daten enthalten:

- Ziel-U-Werte und Ampelgrenzen
- Bestands-U-Werte nach Bauperiode
- λ-Standardwerte
- Kostenmodelle und Sowiesokosten
- Nutzungsdauern und Instandhaltung
- Energiepreise und Preisentwicklungsraten
- Emissionsfaktoren
- Quellen, Datenstand und Version

Aus der Exceldatei werden kleine JSON-Dateien für GitHub Pages erzeugt.

## 17. Bericht

Der Bericht dokumentiert mindestens:

- Zweck und verglichene Varianten
- alle Eingangsdaten und Quellen
- Betrachtungszeitraum
- Zinssatz und Preisentwicklungsraten
- Umsatzsteuer
- Kosten und kostenmindernde Positionen
- Nutzungsdauern
- verwendete Berechnungsmethoden
- Ergebnisse und Sensitivitäten
- Modell- und Datenversion

## 18. Umsetzungsreihenfolge

1. Master-Exceldatei und JSON-Export
2. gemeinsame Maßnahmenstruktur
3. Oberfläche Außenwand, Dach/OGD und Kellerdecke
4. dynamischer Wirtschaftlichkeitskern anbinden
5. CO₂ und Komfort
6. Fenster und Türen als diskrete Varianten
7. direkter Einstieg aus Energiefluss
8. Übergabe an Wirtschaftlichkeit und Sanierungsfahrplan
