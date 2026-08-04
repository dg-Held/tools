# Bauteil & Sanierung – Methodik und Berechnungsgrundlagen

**Stand:** 04.08.2026  
**Toolstand:** Arbeitsversion V0.1  
**Rechenkern:** `EnvelopeRenovationCore 0.1.0`  
**Wirtschaftlichkeitskern:** `EnergyEconomicsCore 1.0.0`

## 1. Zweck

Das Tool untersucht ein einzelnes Bauteil der thermischen Gebäudehülle. Energiefluss bleibt das Diagnosewerkzeug; Bauteil & Sanierung vergleicht technisch mögliche Sanierungsvarianten und deren Energie-, Kosten-, CO₂- und Komfortwirkung.

V0.1 unterstützt als Dämmmaßnahmen:

- Außenwand gegen Außenluft,
- Dach/Dachschräge,
- oberste Geschoßdecke,
- Kellerdecke/Decke gegen unbeheizten Bereich,
- Boden gegen Erdreich.

Fenster und Türen sind im Datenmodell vorgesehen, werden aber erst als diskrete Austauschvarianten umgesetzt.

## 2. Datenpriorität

Fläche und Bestands-U-Wert werden aus dem gemeinsamen Projekt übernommen. Es gilt:

```text
manuell bestätigt → amtlich → abgeleitet → Fallback
```

Änderungen an Fläche oder U-Wert werden als manuelle Projektwerte gespeichert und stehen anschließend auch im Energiefluss zur Verfügung.

## 3. U-Wert einer zusätzlichen Dämmschicht

Für eine homogene zusätzliche Dämmschicht gilt:

```text
U_neu = 1 / (1/U_Bestand + d/λ)
```

mit:

- `d` Dämmdicke in m,
- `λ` Wärmeleitfähigkeit in W/(m·K).

Die erforderliche Dicke für einen Ziel-U-Wert wird aus derselben Beziehung abgeleitet. Empfehlung und ambitionierter Zielwert stammen aus `shared/data/measures/envelope-targets.json`.

## 4. Varianten und Rundung

Die Beratungstabelle zeigt Varianten in 2-cm-Schritten. Für das interne Kosten- und Amortisationsoptimum werden feinere Zwischenvarianten untersucht. Die Rechenwerte bleiben ungerundet; nur die Ausgabe wird bewusst vereinfacht:

- Dämmdicke: 2 cm,
- U-Wert: 2 Dezimalstellen,
- Richtpreise: 10 €/m²,
- Investitionssummen: 500 €,
- jährliche Kostenwirkung: 50 €/a,
- CO₂: 100 kg/a.

## 5. Energieeinsparung

### 5.1 Vorrang: kalibrierter Energiefluss

Liegt ein Energiefluss-Ergebnis vor, wird der bestehende Bauteilverlust übernommen. Der neue Verlust wird proportional zum Verhältnis der U-Werte berechnet:

```text
Q_neu = Q_Bestand × U_neu / U_Bestand
```

Damit bleibt die Maßnahme an der verbrauchsbasierten Gebäudebilanz kalibriert.

### 5.2 Fallback: U × A und Standortklima

Ohne Energiefluss kann überschlägig gerechnet werden:

```text
Q = A × U × Heizgradstunden × Temperaturfaktor / 1.000
```

Bei Bauteilen gegen unbeheizte Bereiche oder Erdreich ist der sichtbare Temperaturfaktor nur eine grobe Orientierung. Für diese Bauteile ist die Energiefluss-Übernahme vorzuziehen.

## 6. Empfehlung und ambitionierter Standard

Das Tool zeigt keine attraktive Karte „Mindestanforderung“. Rechtliche und förderbezogene Werte werden nur als versionierter Prüfhinweis geführt. Die Hauptkarten sind:

- Empfehlung,
- wirtschaftlicher Bereich,
- ambitionierter Standard.

Eine Variante, die hinterlegte rechtliche Prüfdaten möglicherweise nicht erfüllt, muss künftig einen Warnhinweis auslösen. Die Prüfdaten ersetzen keine aktuelle Rechts- oder Förderprüfung.

## 7. Kostenmodell und Sowiesokosten

Das Kostenmodell verwendet:

```text
Vollkosten = Fläche × (Sockelkosten + variable Kosten je cm × Dämmdicke)
```

Bei ohnehin erforderlicher Erneuerung wird die Referenzvariante mit den Sowiesokosten angesetzt. Dadurch werden beim Variantenvergleich nicht die gesamten Baumaßnahmenkosten der Energieeinsparung zugerechnet.

Die Kostenbrücke lautet:

```text
Gesamtkosten
− Sowiesokosten
= energetische Mehrkosten
− bestätigte Förderung
= relevante Eigeninvestition
```

Förderungen beeinflussen die Kundenansicht, nicht das technische Kostenoptimum ohne Förderung.

## 8. Dynamische Wirtschaftlichkeit

Der gemeinsame Wirtschaftlichkeitskern bildet unter anderem ab:

- Barwerte,
- Annuitäten,
- Wiederbeschaffung,
- Entsorgung und Restwerte,
- jährlich wiederkehrende Kosten,
- dynamische Amortisation nach Kumulationsmethode,
- Gesamtkosten über den Betrachtungszeitraum.

Das Kostenoptimum ist die Variante mit den geringsten Gesamtkosten über den Betrachtungszeitraum. Der wirtschaftliche Bereich umfasst in V0.1 Varianten, deren Gesamtkosten höchstens 5 % über dem Minimum liegen.

Die kürzeste Amortisation und das Kostenoptimum dürfen bei unterschiedlichen Dämmdicken liegen und werden getrennt ausgewiesen.

## 9. Vereinfachtes analytisches Optimum

Für opake Bauteile gegen Außenluft kann ergänzend die vereinfachte optimale Dämmdicke nach dem informativen Anhang B der ÖNORM B 8110-4:2024 berechnet werden.

Sie benötigt insbesondere:

- HGT 22/14,
- λ-Wert,
- Energiepreis,
- Jahresnutzungsgrad,
- Kalkulationszins,
- Energiepreisentwicklung,
- Nutzungsdauer der Dämmung,
- volumenbezogenen Preis der wirksamen Dämmschicht.

Nicht zulässig ist diese Vereinfachung insbesondere für erdberührte Bauteile. Förderung, Instandhaltung, Entsorgung und komplexe Kostenmodelle werden darin nicht vollständig abgebildet. Deshalb bleibt der diskrete dynamische Variantenvergleich die Hauptmethode.

## 10. CO₂

V0.1 berechnet nur betriebliche Emissionen:

```text
CO₂-Einsparung = Endenergieeinsparung × Emissionsfaktor
```

Der Emissionsfaktor ist projektbezogen einzugeben, bis die Masterdatei mit dokumentierten Faktoren befüllt ist. Graue Emissionen werden nicht mit der betrieblichen Einsparung vermischt.

## 11. Wohnkomfort

Die innere Oberflächentemperatur wird überschlägig berechnet:

```text
θ_si = θ_i − U × (θ_i − θ_Grenze) × R_si
```

Die Darstellung macht den Behaglichkeitsgewinn greifbar. Wärmebrücken, Luftdichtheit, Feuchteschutz und Anschlussdetails bleiben Gegenstand der Fachplanung.

## 12. Aussagegrenzen

Das Tool ist eine überschlägige Beratungshilfe und kein Energieausweis, keine Ausführungsplanung, keine Förderzusage und keine Rechtsauskunft. Wirtschaftliche Ergebnisse hängen wesentlich von Kosten, Nutzungsdauer, Zinssatz, Preisentwicklung, Energiepreis und Ausgangslage ab. Sensitivitäten und Quellen müssen im späteren endgültigen Bericht vollständig dokumentiert werden.
