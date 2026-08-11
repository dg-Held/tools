# Roadmap

**Stand:** 11.08.2026

## Aktuelle finale V1.0-Schleife

Die drei geplanten Praxisfälle plus ein zusätzlicher realer Vergleichsfall wurden durchgespielt. Die folgenden Punkte sind für die aktuelle Fassung bestätigt und werden abgeschlossen:

1. Fensterflächenanteil als einfache Erstannahme auf **20 %** setzen; Regler 10–50 % und direkte Fensterfläche bleiben erhalten.
2. Außenwand toolübergreifend eindeutig als **opake Außenwand ohne Fenster** definieren. Standortpass ist die gemeinsame Quelle; Energiefluss, Bauteil & Sanierung und spätere Wirtschaftlichkeit verwenden denselben Projektwert.
3. Alte Standortpass-Projekte mit früherer Brutto-Außenwand-Semantik beim Laden einmalig migrieren.
4. Beheizten Anteil synchronisieren; bewusst gewählte 100 % dürfen nicht durch einen älteren Flächenwert wieder auf 99 % zurückspringen.
5. Standortpass in **„Standortpass Gebäude & Umgebung“** umbenennen und DKM als visuelle Ebene über dem Orthofoto ergänzen.
6. Druckberichte aller bestehenden Tools auf einen gemeinsamen Stil bringen: Projektkopf, größerer Tooltitel, kompakter Beratungsinhalt, kleine Methoden-/Versionszeile.
7. Vollständige zentrale Dokumentation, Datenmodell-, Wartungs- und Releasehinweise aktualisieren.

## HWB aus U-Werten – V1.0-Methodenstand

Die Praxisprüfung ist in die aktuelle V1.0-Kandidatenfassung eingeflossen. Der verbrauchsbasierte HWB bleibt unverändert. Der unabhängige zweite Prüfweg verwendet nun:

- U-Werte und gemeinsame Hüllflächen,
- INCA-Vollbenutzungsstunden und gewählte Raumtemperatur,
- unveränderten vereinfachten Lüftungsansatz,
- 7,5 % Wärmebrückenzuschlag,
- interne und solare Gewinne mit einem transparenten pauschalen Gewinnnutzungsfaktor von 0,55.

Der Wert bleibt ausdrücklich ein Beratungs-Plausibilitätsmodell und keine Energieausweis- oder Norm-HWB-Berechnung. Weitere reale Energieausweise sollen als Regressionen ergänzt werden; falls sich ein stabileres einfaches Modell ergibt, wird dieser Punkt in einer V1.x-Version erneut bewertet.

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

## Nach der V1.0-Abnahme

### Bestehende Tools erweitern

- Klima: Temperatur-Heatmap.
- Klima/Standort: Windrose, sobald geeignete amtliche Windrichtungs-/Windgeschwindigkeitsdaten in die Datenpipeline aufgenommen sind.
- Standortpass: DKM-/Orthofoto-Prüfung weiter verfeinern; später ggf. angrenzende Gebäude einfacher erfassen.

### Allgemeines Wirtschaftlichkeitstool

Vergleicht gespeicherte Maßnahmen und automatische Maßnahmenpakete:

- Außenwand,
- Fenster,
- Haustür,
- Dach/OGD,
- Kellerdecke/Boden,
- später Heizung, Verteilung und Lüftung.

Stufen:

- Schnellabschätzung,
- verbrauchsbasiert,
- energieausweisbasiert.

### Sanierungsfahrplan

- Maßnahmenkacheln,
- jetzt / kurzfristig / mittelfristig / später,
- Abhängigkeiten und Reihenfolgehinweise,
- Kommentare,
- kompakter Beratungsbericht.

## Grundsatz

Bei jedem neuen Werkzeug gilt:

> Bringt es in einer realen Energieberatung einen eigenen klaren Mehrwert, oder gehört es als Funktion in ein bestehendes Tool?
