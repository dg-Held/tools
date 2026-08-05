# Testplan – Bauteil & Sanierung V0.5

## 1. Baujahr und Bestands-U-Wert

1. Neues/leeres Projekt öffnen.
2. Außenwand wählen.
3. Baujahr 1975 eingeben und Feld verlassen.
4. Prüfen, ob ein U-Wert-Vorschlag aus der Bauperiode erscheint.
5. U-Wert manuell überschreiben.
6. Baujahr ändern: der manuelle U-Wert muss erhalten bleiben.
7. U-Wert leeren: Feld muss Berry markiert sein und die Berechnung pausieren.

## 2. Fenster

1. Fenster wählen.
2. Prüfen, dass kein λ-Feld sichtbar ist.
3. Rahmenmaterial Holz, Kunststoff, Holz-Aluminium und Aluminium wechseln.
4. Holz/Aluminium: Herkunftshinweis für informative Normwerte prüfen.
5. Kunststoff/Holz-Aluminium: transparenter Projekt-Fallback prüfen.
6. Varianten, Kosten, Förderung, Infografik, Druck und Maßnahmenspeicherung prüfen.

## 3. Haustür

1. Haustür/Außentür wählen.
2. Prüfen, dass kein λ- und kein Rahmenfeld erscheint.
3. Fläche und Anzahl 1 eingeben.
4. Bei Richtpreis 4.000 €/Stk. müssen die Vollkosten einer mittleren Variante etwa 4.000 € und nicht Fläche × 4.000 € betragen.
5. Anzahl auf 2 ändern: Kosten müssen sich verdoppeln; Energieeinsparung bleibt flächenbezogen.
6. Sowiesokosten, Förderung, Varianten, Infografik, Ausdruck und gespeicherte Maßnahme prüfen.

## 4. Eigene SVGs

1. Eine vorhandene eigene SVG laden.
2. Prüfen, dass die integrierte Fallbackgrafik nicht zusätzlich sichtbar ist.
3. SVG testweise umbenennen und Seite neu laden: Fallback muss erscheinen.
4. Haustürdateien `bestand-aussentuer.svg` und `sanierung-aussentuer.svg` testen.

## 5. BGF und Volumen

1. Standortpass mit Gebäude öffnen.
2. BGF manuell ändern.
3. Prüfen, dass ein nicht manuell bestätigtes Volumen automatisch nachgeführt wird.
4. Volumen manuell überschreiben.
5. BGF erneut ändern: manuelles Volumen muss bleiben, automatische Ableitung muss als Hintergrundwert aktualisiert werden.
6. JSON exportieren/importieren und Werte erneut prüfen.

## 6. Regression

- opake Dämmmaßnahmen rechnen weiterhin,
- Energiefluss→Bauteil-Link funktioniert,
- Adresse/Geometrie bleibt gemeinsam,
- Druck enthält keine vollständige Variantentabelle,
- Projektimport/-export funktioniert,
- Browserkonsole bleibt fehlerfrei.
