# Testplan – Bauteil & Sanierung V0.2 / Energiefluss V4.4

## A. Energiefluss

1. Energiefluss V4 öffnen.
2. Prüfen, ob Baujahr/Baubewilligung sofort sichtbar ist.
3. Ein Baujahr ohne manuell bestätigte U-Werte eingeben und U-Wert-Vorschläge prüfen.
4. Einen U-Wert manuell bestätigen, Baujahr ändern und prüfen, dass der manuelle U-Wert bestehen bleibt.

## B. Vereinfachte Oberfläche

1. Bauteil & Sanierung öffnen.
2. Prüfen, ob nur Bauteil, Fläche, U-Wert und λ direkt sichtbar sind.
3. λ „eigener Wert“ auswählen und prüfen, ob das Zusatzfeld erscheint.
4. Erweiterte technische Eingaben öffnen und schließen.

## C. Automatische Kostenwerte

Für Außenwand, OGD, Dach, Kellerdecke und Boden prüfen:

- Kostenstatus sichtbar,
- Kostenspanne beziehungsweise Vorschlag geladen,
- Detailwerte im eingeklappten Bereich vorhanden,
- Nutzungsdauer und Finanzannahmen vorbelegt,
- Energiepreis und CO₂-Faktor ändern sich mit dem Energieträger.

Vorschlagswerte für Dach und Boden müssen als Vorschlag/prüfpflichtig erkennbar sein.

## D. Förderungen

1. Landesförderung: 20 % der Vollkosten.
2. Bundesförderung: Fixbetrag 3.000 €.
3. Sonstige Förderung: 10 % der energetischen Mehrkosten.
4. Prüfen, ob die drei Beträge summiert und in der Kostenbrücke abgezogen werden.
5. Alle Fördermodi auf „nicht berücksichtigt“ zurückstellen.

## E. Berechnung

- Empfehlung und ambitionierter Standard,
- Kostenoptimum,
- kürzeste Amortisation,
- CO₂-Einsparung,
- Oberflächentemperatur,
- Variantenvergleich,
- Speicherung der Maßnahme.

## F. HGT und Temperaturkorrektur

- Der normale Variantenvergleich muss ohne HGT 22/14 funktionieren.
- Bei vorhandener Energiefluss-Basis hat die Temperaturkorrektur keinen Einfluss auf den kalibrierten Bauteilverlust.
- Ohne Energiefluss/Klimabasis muss eine Änderung von 1,0 auf 0,5 den klimabasierten Verlust ungefähr halbieren.

## G. Bildschirm und Druck

1. Unterhalb der Methodik darf kein zweiter sichtbarer Ergebnisblock erscheinen.
2. Drucken/PDF öffnen.
3. Der kompakte Druckbericht muss erscheinen.
4. Kostenbrücke und ausgewählte Variante müssen vollständig sein.

## H. Projektpersistenz

- Seite neu laden,
- JSON exportieren/importieren,
- Bauteil wechseln,
- kontrollieren, ob manuelle Förder- und Annahmewerte je Bauteil erhalten bleiben.
