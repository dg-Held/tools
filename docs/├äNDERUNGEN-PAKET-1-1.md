# Änderungen – Stabilisierungspaket 1.1

## Klima – Druck

- angehängte leere zweite Seite unterdrückt
- Abstand zwischen gemeinsamer Projektkopfzeile und Titel verbessert
- Diagrammhöhe für einen kompakten einseitigen A4-Ausdruck angepasst

## Heizlast – Druck

- Heizlastbericht steht im Vordergrund
- Klimagrundlage wurde an das Ende verschoben und stark verdichtet
- fünf kompakte Klimawerte: NAT, Zeitraum, Höhe, Quelle und Heizgrenze
- repräsentative Druckprüfung auf einer A4-Seite bestanden

## Heizgrenztemperatur

- Eingabe im Bereich 8–18 °C
- manuelle Eingabe hat Vorrang und wird projektweit gespeichert
- automatische Empfehlung aus dem verbrauchsbezogenen Raumwärmewert:
  - unter 25 kWh/m²a → 12 °C
  - 25 bis unter 50 → 13 °C
  - 50 bis unter 100 → 14 °C
  - 100 bis 150 → 15 °C
  - über 150 → 16 °C
- 15 °C bleibt Fallback, wenn Verbrauch oder beheizte Nutzfläche fehlen
- die gewählte Heizgrenze beeinflusst Heizstunden, Vollbenutzungsstunden, verbrauchsbasierte Heizlast und Dauerlinie
- automatische Empfehlung kann nach manueller Änderung wiederhergestellt werden

Die Empfehlung ist ein transparenter Beratungsfaustwert und kein normativer Nachweis.

## Standortpass – Gebäudeauswahl

- manuell ausgewähltes Gebäude wird als Quellen-Snapshot gespeichert
- Polygon, Attribute, Objekt-ID und Auswahlart bleiben bei Neuladen und JSON-Export/-Import erhalten
- beim Wiederherstellen wird das gespeicherte Gebäude zuerst angezeigt
- der automatische Bericht überspringt eine bereits bestätigte Gebäudezuordnung
- manuelle Geometriekorrekturen bleiben erhalten

## Standortpass – Geschosse und Flächen

Neu in der gemeinsamen Geometriebasis:

- oberirdische Geschoße
- Bruttogeschoßfläche (BGF)
- Nutzfläche (NFL)
- beheizte Nutzfläche

Automatische Erstannahmen:

- Geschoße = Medianhöhe / 3,2 m, auf eine ganze Zahl gerundet
- mindestens ein oberirdisches Geschoß
- BGF = Dachprojektion × Geschoße
- NFL = BGF × 0,75
- beheizte Nutzfläche = NFL als Fallback

BGF, NFL und beheizte Nutzfläche bleiben getrennte Projektwerte. Ein bereits manuell bestätigter Wert aus Heizlast oder einem späteren Tool bleibt vorrangig.

## Naturgefahren

- HQ30, HQ100 und HQ300 werden parallel abgefragt
- weitere TIRIS-Naturgefahrenebenen werden mit maximal fünf gleichzeitigen Anfragen geladen
- laufender Fortschritt wird angezeigt
- Metadaten des TIRIS-Dienstes werden während der Sitzung wiederverwendet

## Unverändert

- Solarpotential und Orthofoto
- große Klima-, Adress- und OIB-Daten
- Energiefluss V3
