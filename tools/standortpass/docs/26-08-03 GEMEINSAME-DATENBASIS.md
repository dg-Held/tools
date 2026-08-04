# Standortpass – gemeinsame Datenbasis

**Erstfassung:** 03.08.2026  
**aktualisiert:** 04.08.2026

Der Standortpass bleibt eigenständig nutzbar. Adresse, Gebäudeidentität, Geometrie, automatische Ausgangswerte und manuelle Korrekturen liegen im gemeinsamen Projektmodell. Klima, Heizlast und Energiefluss V4 greifen auf dieselben Werte und Dienste zu. Keine Tool-Seite muss zuvor geöffnet worden sein.

Die Umstellung auf die endgültigen gemeinsamen Datenpfade ist abgeschlossen:

```text
shared/data/addresses/
shared/data/climate/inca/
shared/data/standards/oib/
```

Der frühere kombinierte Ordner `tools/klima-heizlast/` ist keine Laufzeitabhängigkeit mehr.

## Automatische und manuelle Geometriewerte

Automatische Ausgangswerte und manuelle Korrekturen werden getrennt gespeichert. Ein manuell bestätigter Wert hat Vorrang, ohne den automatischen Ursprungswert zu löschen.

Beispiel:

```text
Beheizte Nutzfläche wirksam: 165 m² – manuell bestätigt
Automatische Abschätzung:    150 m² – aus Gebäudegeometrie
```

Eine im Heizlast- oder Energiefluss-Tool vorgenommene Korrektur erscheint deshalb auch im Standortpass.

## Gebäudezuordnung

Eine bestätigte manuelle TIRIS-Gebäudeauswahl wird als Quellen-Snapshot gespeichert:

- Objekt-ID,
- Auswahlart automatisch/manuell,
- Attribute,
- Polygon,
- Geometrie- und Höhenwerte,
- Datenstand.

Beim Neuladen oder JSON-Import wird zuerst dieser bestätigte Stand wiederhergestellt. Eine spätere automatische Abfrage darf die bestätigte Zuordnung nicht kommentarlos verwerfen.
