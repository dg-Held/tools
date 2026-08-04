# Gemeinsame Gebäudedaten

## `existing-u-values.json`

Bestands-U-Wert-Vorschläge nach Bauperiode. Die Werte dienen ausschließlich als sichtbare Ausgangsvorschläge, wenn keine konkreten Bauteildaten bekannt sind.

Priorität:

```text
manuell bestätigt → übernommen/amtlich → Bauperiodenvorschlag → Zustandsfallback
```

## `envelope-evaluation.json`

Enthält Ampelgrenzen, fachliche Empfehlung, ambitionierten Zielwert sowie versionierte rechtliche/förderbezogene Referenzwerte.

Rechtliche und förderbezogene Werte dürfen nur als Prüfhinweis verwendet werden. Vor Umsetzung ist der aktuelle projektspezifische Stand zu prüfen.

## Pflege

Langfristig werden beide JSON-Dateien aus einer wartbaren Excel-Masterdatei erzeugt. Jede Änderung benötigt Datenstand, Quelle und Regressionstest.
