# Testplan – Bauteil & Sanierung V0.1

## A. Einstieg aus Energiefluss

1. Energiefluss V4.3 mit Projektwerten öffnen.
2. Bei Außenwand auf „Bauteil sanieren“ klicken.
3. Prüfen: Außenwand, Fläche und Bestands-U-Wert werden übernommen.
4. U-Wert oder Fläche im Bauteiltool ändern.
5. Energiefluss erneut öffnen: der manuelle Wert muss übernommen sein.

## B. Technische Varianten

Testwerte:

- Fläche 200 m²,
- U Bestand 1,20 W/m²K,
- λ 0,035 W/mK.

Prüfen:

- Empfehlung liegt bei ungefähr 16 cm für Ziel U 0,20,
- U-Wert bei 16 cm ungefähr 0,19 W/m²K,
- ambitionierter Zielwert benötigt eine größere Dämmdicke,
- Varianten werden in 2-cm-Schritten angezeigt.

## C. Energiegrundlage

1. Mit vorhandenem Energiefluss prüfen: kalibrierter Bauteilverlust wird angezeigt.
2. Ohne Energiefluss, aber mit Klima: U × A-Klimarechnung wird verwendet.
3. Ohne beides: technische Varianten funktionieren; Energie-/Kostenwirkung bleibt als fehlend gekennzeichnet.
4. Mit Projektadresse „Klimawerte berechnen“ testen.

## D. Kosten und Sowiesokosten

Beispielwerte:

- Ausgangslage: Erneuerung ohnehin erforderlich,
- Sockelkosten 180 €/m²,
- variable Kosten 3 €/m²·cm,
- Sowiesokosten 100 €/m²,
- Nutzungsdauer 40 Jahre,
- Energiepreis 0,14 €/kWh,
- Betrachtungszeitraum 30 Jahre.

Prüfen:

- Kostenoptimum und kürzeste Amortisation werden getrennt ausgewiesen,
- Kostenbrücke rechnet Vollkosten, Sowiesokosten und energetische Mehrkosten,
- Summen werden auf 500 € gerundet angezeigt,
- Änderung des Zinssatzes oder Energiepreises verändert das Ergebnis.

## E. Förderung

1. Förderung „Betrag“ wählen und Wert eingeben.
2. Prüfen: technische Kostenkurve bleibt unverändert.
3. Kostenbrücke und relevante Eigeninvestition ändern sich.

## F. CO₂ und Komfort

1. Emissionsfaktor eingeben.
2. Prüfen: CO₂-Einsparung erscheint und wird auf 100 kg/a gerundet.
3. Oberflächentemperatur muss von Bestand zu Sanierung steigen.

## G. Projektspeicherung

1. Variante wählen und „Maßnahme im Projekt speichern“ drücken.
2. Projekt als JSON exportieren.
3. Prüfen: unter `measures.envelope-<Bauteil>` ist genau eine Maßnahme gespeichert.
4. JSON erneut importieren und Tool öffnen.

## H. Druck

1. Druck/PDF oben und unten testen.
2. Projektkopf, Ausgangslage, ausgewählte Variante, Kostenbrücke und Orientierungspunkte prüfen.
3. Keine leeren Zusatzseiten.
