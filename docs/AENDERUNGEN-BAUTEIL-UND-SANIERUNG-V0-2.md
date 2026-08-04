# Änderungen – Bauteil & Sanierung V0.2 / Energiefluss V4.4

**Stand:** 04.08.2026

## Energiefluss V4.4

- Baujahr/Baubewilligungsjahr steht nun direkt sichtbar bei den Kernwerten.
- Das Baujahr beeinflusst bereits die Bestands-U-Wert-Fallbacks, sofern kein höher priorisierter U-Wert vorhanden ist.
- Manuell bestätigte oder übernommene U-Werte bleiben vorrangig.

## Bauteil & Sanierung V0.2

- Hauptansicht deutlich vereinfacht.
- Eigener λ-Wert erscheint nur nach Auswahl „eigener Wert“.
- Jahresnutzungsgrad, HGT 22/14, Temperaturkorrektur und Raumtemperatur liegen unter „Erweiterte technische Eingaben“.
- HGT 22/14 bleibt optional und wird nicht aus anderen INCA-Kennwerten geraten.
- Richtkosten, Nutzungsdauer, Energiepreis, Emissionsfaktor und Finanzannahmen werden aus zentralen Datendateien vorgeschlagen.
- Kosten- und Finanzdetails sind standardmäßig eingeklappt.
- Förderungen bestehen aus drei freien projektbezogenen Feldern: Land, Bund, Sonstige.
- Je Förderung sind Fixbetrag, Prozent der Vollkosten oder Prozent der energetischen Mehrkosten möglich.
- Der zusätzliche Druckbericht ist auf der Bildschirmseite verborgen und erscheint nur beim Drucken.
- `EnvelopeRenovationCore` auf Version 0.2.0 erweitert.

## Daten

- bestätigte EAT-Richtwerte übernommen,
- fehlende Kostenwerte als deutlich gekennzeichnete Projektvorschläge ergänzt,
- Nutzungsdauern als noch zu bestätigende Projektvorschläge hinterlegt,
- Energiepreise und Emissionsfaktoren aus der ausgefüllten Masterdatei übernommen,
- Finanz-Fallbacks: 30 Jahre, 3 % Zins, 3 % Energiepreisentwicklung, 2 % Investition/Wiederbeschaffung, 2 % Entsorgung.
