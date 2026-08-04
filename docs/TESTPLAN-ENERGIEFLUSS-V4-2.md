# Testplan – Energiefluss V4.2

## Installation

Paketinhalt über den Website-Hauptordner kopieren und gleichnamige Dateien ersetzen. Danach Browsercache mit `Strg + F5` aktualisieren.

## A. Flächenrundung

1. Projekt mit Standortpass-Geometrie öffnen.
2. Prüfen: Außenwand/OGD/Dach/Kellerdecke/Boden sind Vielfache von 10 m².
3. Prüfen: Fenster ist ein Vielfaches von 5 m².
4. Manuell z. B. Außenwand `283` eingeben → erwartet `280`.
5. Fenster `38` eingeben → erwartet `40`.
6. Zurücksetzen: automatische gerundete Anzeige erscheint; Quellenrohwert bleibt erhalten.

## B. Direkte Klimaberechnung

1. Projektadresse mit eindeutiger KG wählen.
2. Energiefluss ohne vorherigen Besuch des Klima-Tools öffnen.
3. „Klimawerte berechnen“ drücken.
4. Rechnerischer Verbrauch und Abweichung müssen erscheinen.
5. Klima-Tool öffnen und prüfen, ob Projektadresse/Klimakontext zusammenpassen.
6. Bei Adresse mit mehreren KG muss eine verständliche Aufforderung zur KG-Auswahl erscheinen.

## C. Plausibilitätsvergleich

1. U-Wert Außenwand verschlechtern → rechnerischer Verbrauch steigt.
2. U-Wert verbessern → rechnerischer Verbrauch sinkt.
3. Gemessener Verbrauch und farbige Bilanzsumme bleiben unverändert.
4. Abweichung wird in 5-Prozent-Schritten angezeigt.

## D. Info-Symbole

- Maus-Hover,
- Tastaturfokus mit Tab,
- Antippen auf Mobilgerät,
- Tooltips überdecken keine wichtigen Eingaben dauerhaft.

## E. Methodik und Dokumentation

- aufklappbarer Bereich enthält alle sichtbaren Rechenwege,
- Formeln stimmen mit `energy-flow-core.js` überein,
- Dokumentationsindex und Tool-Dokumente sind vorhanden.

## F. Druck

- genau zwei A4-Seiten,
- keine leere Zwischenseite,
- Seite 1 Energiefluss und Ausgangslage,
- Seite 2 Gebäudehülle und Datenbasis,
- Titel zeigt V4.2.

## G. Regression

- Standortpass funktioniert,
- Klima funktioniert,
- Heizlast funktioniert,
- V3 bleibt unverändert.
