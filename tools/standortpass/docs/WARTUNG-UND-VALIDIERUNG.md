# Standortpass – Wartung und Validierung

**Stand:** 04.08.2026

## Zuständigkeiten

- `shared/js/services/address-provider-*.js`: Adresssuche und TIRIS-/BEV-Abgleich
- `shared/js/services/building-geometry-service.js`: gemeinsame TIRIS-Gebäudeumwandlung
- `tools/standortpass/standortpass.js`: fachliche Liveabfragen und Kartendarstellung
- `tools/standortpass/standortpass-v1.js`: Projektanbindung, Geometrieabschätzungen und Druck
- `tools/standortpass/standortpass.css`: toolspezifische Darstellung

## Pflichtprüfungen

1. Adresse mit eindeutigem Gebäude testen.
2. Adresse ohne automatische Gebäudezuordnung testen und Gebäude manuell wählen.
3. Seite neu laden: Polygon und manuelle Auswahl müssen erhalten bleiben.
4. JSON exportieren/importieren: bestätigte Gebäudeauswahl muss wiederhergestellt werden.
5. Geschosse ändern: BGF und NFL müssen folgen, sofern sie nicht manuell bestätigt wurden.
6. BGF ändern: NFL muss folgen, sofern NFL nicht manuell bestätigt wurde.
7. NFL manuell ändern: vorgelagerte Änderungen dürfen sie nicht überschreiben.
8. Beheizte Nutzfläche muss unabhängig bleiben.
9. Naturgefahrenfortschritt und Fehler einzelner Layer prüfen.
10. Zwei A4-Druckseiten prüfen.
11. Energiefluss und Heizlast öffnen und gemeinsame Geometrie-/Flächenwerte vergleichen.

## Referenzlogik Geometrie

```text
Geschosse = ganzzahlig gerundet(Medianhöhe / 3,2 m)
BGF       = Dachprojektion × Geschosse, auf 10 m²
NFL       = BGF × 0,75, auf 5 m²
```

Manuelle Werte unterbrechen die automatische Kette an der jeweiligen Stelle.

## Adresswechsel

Prüfen:

- Neue Suchtexte verändern das bestehende Projekt noch nicht.
- „Adresse korrigieren“ behält manuelle Nutzerwerte, verwirft aber alte standortabhängige Automatiken.
- „Neues Projekt starten“ übernimmt keine Gebäudedaten des alten Projekts.
- „Abbrechen“ ändert nichts.

## Externe Dienste

Externe ArcGIS-/TIRIS-Dienste können langsam, zeitweise nicht erreichbar oder strukturell geändert sein. Fehler müssen als „nicht geprüft“ oder „Dienst nicht erreichbar“ erscheinen und dürfen nicht als negatives Prüfergebnis interpretiert werden.

## Änderungsregel

Bei Änderung einer Formel, Rundung oder Quellenpriorität gleichzeitig aktualisieren:

1. Toolcode,
2. sichtbare Methodik,
3. `METHODIK-UND-DATENBASIS.md`,
4. Testfälle,
5. Druckbericht.
