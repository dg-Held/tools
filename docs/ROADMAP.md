# Roadmap

**Stand:** 10.08.2026

## Aktuelle finale V1.0-Schleife

Die drei geplanten Praxisfälle plus ein zusätzlicher realer Vergleichsfall wurden durchgespielt. Die folgenden Punkte sind für die aktuelle Fassung bestätigt und werden abgeschlossen:

1. Fensterflächenanteil als einfache Erstannahme auf **20 %** setzen; Regler 10–50 % und direkte Fensterfläche bleiben erhalten.
2. Außenwand toolübergreifend eindeutig als **opake Außenwand ohne Fenster** definieren. Standortpass ist die gemeinsame Quelle; Energiefluss, Bauteil & Sanierung und spätere Wirtschaftlichkeit verwenden denselben Projektwert.
3. Alte Standortpass-Projekte mit früherer Brutto-Außenwand-Semantik beim Laden einmalig migrieren.
4. Beheizten Anteil synchronisieren; bewusst gewählte 100 % dürfen nicht durch einen älteren Flächenwert wieder auf 99 % zurückspringen.
5. Standortpass in **„Standortpass Gebäude & Umgebung“** umbenennen und DKM als visuelle Ebene über dem Orthofoto ergänzen.
6. Druckberichte aller bestehenden Tools auf einen gemeinsamen Stil bringen: Projektkopf, größerer Tooltitel, kompakter Beratungsinhalt, kleine Methoden-/Versionszeile.
7. Vollständige zentrale Dokumentation, Datenmodell-, Wartungs- und Releasehinweise aktualisieren.

## Fachlich noch offen vor einer Änderung des Rechenkerns

### HWB aus U-Werten

Höchste Priorität. Der aktuelle Rechenkern bleibt bis zur Entscheidung unverändert.

Zu prüfen:

- Bilanztemperatur 15 °C und Bedeutung der daraus gebildeten HGT,
- Verhältnis von tatsächlicher Innen-/Außentemperatur zu Bilanztemperatur,
- interne Gewinne,
- solare Gewinne und Gewinnnutzung,
- Lüftungsverlustmodell,
- Wärmebrückenzuschlag,
- Abgrenzung zwischen verbrauchskalibrierter Restbilanz und unabhängigem U×A-Klimamodell.

Zwei konsistente Kandidaten werden gegeneinander validiert:

1. Bilanztemperatur-/Heizgradmodell ohne erneuten vollständigen Gewinnabzug.
2. Explizite Wärmebilanz mit Innen-/Außentemperaturbezug und begrenzter Gewinnnutzung in der Heizperiode.

Nach Auswahl der robustesten Beratungsmethode werden anonymisierte Praxisfälle als Regressionstests hinterlegt.

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
