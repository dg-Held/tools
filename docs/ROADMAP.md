# Roadmap

**Stand:** 13.08.2026

## V1.0-Basis abgeschlossen · 11.08.2026

Die erste große Entwicklungsrunde ist abgeschlossen. Praxisfälle, Geometriekette V1.5, opake Außenwand-/Fenstersemantik, beheizter Anteil, DKM, gemeinsame Druckgestaltung, zentrale Farben, unabhängiger HWB-U-Vergleich sowie zentrale Dokumentation sind Bestandteil des eingefrorenen Basisstands.

Neue Arbeiten starten ab hier als **V1.x-Erweiterung oder neues Tool**. Bereits funktionierende V1.0-Logik wird nur geändert, wenn ein konkreter fachlicher oder technischer Grund vorliegt.

## HWB aus U-Werten – V1.0-Methodenstand

Die Praxisprüfung ist in den abgeschlossenen V1.0-Methodenstand eingeflossen. Der verbrauchsbasierte HWB bleibt unverändert. Der unabhängige zweite Prüfweg verwendet:

- U-Werte und gemeinsame Hüllflächen,
- INCA-Vollbenutzungsstunden und gewählte Raumtemperatur,
- unveränderten vereinfachten Lüftungsansatz,
- 7,5 % Wärmebrückenzuschlag,
- interne und solare Gewinne mit einem transparenten pauschalen Gewinnnutzungsfaktor von 0,55.

Der Wert bleibt ausdrücklich ein Beratungs-Plausibilitätsmodell und keine Energieausweis- oder Norm-HWB-Berechnung. Zusätzliche reale Energieausweise können den Regressionssatz später erweitern. Eine methodische Änderung erfolgt erst in einer dokumentierten V1.x-Version und nur bei erkennbarem fachlichem Mehrwert.

## Für die nächste V1.x-Version vorgemerkt

### Angrenzende Gebäude

Einfache Möglichkeit für Fassaden, die thermisch nicht gegen Außenluft liegen. Favorit:

```text
davon an Nachbargebäude angrenzend: ___ m²
```

Keine komplexe Randbedingungsmatrix. Später sauber festlegen:

- Wirkung auf Transmissionsverlust,
- Wirkung auf thermisch relevante Außenwandfläche,
- Wirkung auf automatische Fassadensanierungs-/Wirtschaftlichkeitsmaßnahmen.

### Warmwasser / Zirkulation / Verteilung

- Personenpauschale für kleine Gebäude beibehalten.
- Für MFH bzw. zentrale Warmwasserversorgung einen optionalen, transparenten Verteil-/Zirkulationsverlust untersuchen.
- Bevorzugt als separater Zuschlag in kWh/a oder % des Warmwasser-Nutzwärmebedarfs; kein versteckter Standardwert ohne belastbare Quelle.
- Keine vollständige Rohrnetz-/Haustechnikberechnung.

## Nächste Entwicklungsstufe

### Bestehende Tools erweitern

- Klima: Temperatur-Heatmap.
- Klima/Standort: Windrose, sobald geeignete amtliche Windrichtungs-/Windgeschwindigkeitsdaten in die Datenpipeline aufgenommen sind.
- Standortpass: DKM-/Orthofoto-Prüfung weiter verfeinern; später ggf. angrenzende Gebäude einfacher erfassen.

### Wirtschaftlichkeit · V0.5 Vorabnahme

Der zweite direkt im Projekt integrierte Prototyp setzt den vollständigen Beratungsablauf auf derselben Projektbasis um:

- Projektbasis prüfen; NFL als zentrale Geometriegröße hervorgehoben,
- Rahmen, Budget und Kundenprioritäten in wenigen Klicks festlegen,
- Maßnahmen eigenständig aus Gebäude/Baujahr/U-Werten vorbereiten oder aus `Bauteil & Sanierung` übernehmen; automatisch abgeleitete Einsparungen werden live aktualisiert,
- thermischen Hüllstatus (u. a. Dach ↔ OGD) respektieren,
- erste Heizung-/PV-Kostenvorschläge,
- bestehende Bauteilförderungen übernehmen und Paketförderungen ergänzen,
- Kostenstruktur, Förderbasis und Finanzierung fachlich getrennt erklären,
- Verbrauch als reale Größenordnung mit der relativen Hüllwirkung des unabhängigen U-Wert-Modells verschneiden und Abweichungen `Verbrauch ↔ Hüllmodell` sichtbar plausibilisieren,
- Energiekosten vorher/nachher, Budgetabgleich und Kundenprioritäten im Ergebnis zeigen,
- Hauptgrafik mit expliziter Referenzlinie plus optionaler Lebenszykluskosten-Zweilinienansicht und beschrifteten €-Achsen,
- Zukunftsfit-2050-Vergleich `Bestand heute ↔ mit gewählter Sanierung`, stabile Accordions und rücksetzbare manuelle Overrides.

V0.5 ergänzt die zentrale Datenrunde für die direkt verwendeten EAT-Kosten-/Referenzmodelle sowie einen ersten vollständigen 2-seitigen Beratungsausdruck. Nächster Schritt ist die Gesamtprüfung/Abnahme mit realen Beratungsfällen und Drucksichtung; danach höchstens eine gezielte Korrekturschleife. Regelbasierte Förderengine, echte automatische Sensitivitätsläufe und PV-Ertrags-/Eigenverbrauchsadapter bleiben klar abgegrenzte Fachausbaustufen.

### Sanierungsfahrplan

- Maßnahmenkacheln,
- jetzt / kurzfristig / mittelfristig / später,
- Abhängigkeiten und Reihenfolgehinweise,
- Kommentare,
- kompakter Beratungsbericht.

## Grundsatz

Bei jedem neuen Werkzeug gilt:

> Bringt es in einer realen Energieberatung einen eigenen klaren Mehrwert, oder gehört es als Funktion in ein bestehendes Tool?
