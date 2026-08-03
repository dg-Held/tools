# Testplan – Grundumbau Pakete 1–4

## A. Allgemein

- Homepage und Toolübersicht öffnen.
- Links zu Standortpass, Klima, Heizlast und Energiefluss prüfen.
- Projektkopf muss auf allen drei umgebauten Tools gleich aussehen.
- Projekttitel und Projekt-ID eingeben, Seite wechseln und Rückübernahme prüfen.
- Drucken/PDF oben und unten prüfen.

## B. Standortpass

1. Adresse suchen und Bericht erstellen.
2. Gebäude auswählen.
3. Eine Geometrie manuell korrigieren.
4. Projekt als JSON exportieren.
5. Seite neu laden: Korrektur muss erhalten bleiben.

## C. Klima

1. `tools/klima/index.html` öffnen.
2. Adresse wählen und analysieren.
3. Prüfen, ob Zeitraum und Jahreslinien aus dem Manifest übernommen werden.
4. Heizlast-Eingabebereich darf auf dieser Seite nicht sichtbar sein.
5. Link „Mit diesen Klimadaten zur Heizlast“ öffnen.

## D. Heizlast

1. `tools/heizlast/index.html` öffnen.
2. Projektadresse muss übernommen werden.
3. Klimagrundlage laden.
4. Kompakte Klimakarte und Heizlastbereich müssen sichtbar sein.
5. Personen und beheizte Nutzfläche ändern.
6. Zur Klima-Seite wechseln und anschließend zurück: Eingaben müssen erhalten sein.

## E. Wertpriorität

1. Im Standortpass einen automatischen Wert erzeugen.
2. Den entsprechenden Wert später manuell überschreiben.
3. Standortpass erneut rechnen lassen.
4. Der manuelle Wert muss wirksam bleiben; der neue automatische Wert muss im
   Projekt weiterhin vorhanden sein.
5. Manuelle Korrektur zurücksetzen: automatischer Wert wird wieder wirksam.

## F. Import alter Projekte

1. JSON eines bisherigen Projekts importieren.
2. Personen und beheizte Nutzfläche in Heizlast prüfen.
3. Projekt erneut exportieren.
4. Export muss `schemaVersion: 2` enthalten.
