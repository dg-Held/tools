# Testplan – Bauteil & Sanierung V0.4

## 1. Grundfunktion Dämmmaßnahmen

1. Außenwand aus Energiefluss V4 öffnen.
2. Fläche und Bestands-U-Wert prüfen.
3. Empfohlenen Mindeststandard, Kostenoptimum und ambitionierte Variante prüfen.
4. Verschiedene Dämmdicken auswählen.
5. Prüfen, ob „Sanierung auf einen Blick“ unmittelbar aktualisiert wird.
6. Maßnahme im Projekt speichern und Seite neu laden.

## 2. Beschriftung und Bedienung

1. Der Rundungshinweis darf nicht im Hauptablauf erscheinen, sondern nur unter Methodik.
2. Überall muss „Empfohlener Mindeststandard“ stehen.
3. Der Förderabschnitt muss beim ersten Öffnen aufgeklappt sein.
4. „Alle Varianten vergleichen“ muss im Web zunächst geschlossen sein.
5. Die früheren vier doppelten Kennwertkarten dürfen nicht mehr vorhanden sein.

## 3. Fenstervergleich – Direkteinstieg

1. Tool direkt über die Toolübersicht öffnen.
2. Bauteil **Fenster** wählen.
3. Adresse auswählen beziehungsweise vorhandenes Projekt verwenden.
4. Prüfen, ob Fensterfläche und Bestands-U-Wert übernommen werden.
5. Holzrahmen auswählen:
   - Nutzungsdauer 30 Jahre,
   - Instandhaltung 1,0 %/a.
6. Aluminiumrahmen auswählen:
   - Nutzungsdauer 30 Jahre,
   - Instandhaltung 0,5 %/a.
7. Prüfen, ob λ-Eingabe ausgeblendet und Fenster-Richtpreise eingeblendet werden.
8. Basis, Mindeststandard und ambitionierte Variante vergleichen.
9. Förderung eingeben und Kostenbrücke prüfen.
10. Fenstervariante im Projekt speichern und Seite neu laden.

## 4. Fenstervergleich – Einstieg aus Energiefluss

1. Energiefluss V4 öffnen.
2. Bei Fenster auf **„Fenster vergleichen“** klicken.
3. Prüfen, ob `component=windows` übernommen wird.
4. Projekt, Adresse, Fläche, Bestands-U-Wert und Bauteilverlust müssen vorhanden bleiben.

## 5. Infografik und eigene SVGs

1. Ohne eigene SVG-Dateien müssen die Fallback-Grafiken sichtbar sein.
2. Testweise `bestand-fenster.svg` und `sanierung-fenster.svg` am vorgesehenen Pfad ablegen.
3. Seite mit Strg+F5 neu laden.
4. Prüfen, ob die SVGs die Fallback-Grafiken ersetzen.
5. Datei testweise entfernen und Fallback erneut prüfen.

## 6. Ausdruck

1. Druckvorschau öffnen.
2. Farbige Infografik, Kostenbrücke und Diagramme prüfen.
3. „Sanierung auf einen Blick“ muss Gesamtkosten und Amortisation enthalten.
4. Ein separater Block „Ausgewählte Variante“ darf nicht gedruckt werden.
5. Die vollständige Tabelle „Alle Varianten vergleichen“ darf nicht gedruckt werden.
6. Die drei Orientierungspunkte müssen sichtbar sein.
7. Keine leere zusätzliche Seite und keine abgeschnittenen Bereiche.
8. Im Browser gegebenenfalls „Hintergrundgrafiken drucken“ aktivieren.

## 7. Regression

1. Adresssuche und TIRIS-Gebäudezuordnung prüfen.
2. HGT-Fallback 3.500 Kd/a prüfen.
3. Landes-, Bundes- und sonstige Förderung testen.
4. Projekt exportieren/importieren.
5. Energiefluss V4 erneut öffnen und prüfen, ob bestehende Projektwerte erhalten bleiben.
