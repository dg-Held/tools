# Änderungen – Energiefluss V4.3 und Fachgrundlage Bauteil & Sanierung

**Stand:** 04.08.2026

## Energiefluss V4.3

- Gebäudehülle unter die Ergebnisgrafik verschoben
- prominente Links zu Standortpass, Heizlast und Klima entfernt
- Klimaberechnung bleibt direkt im Energiefluss verfügbar
- optionales Baujahr/Jahr der Baubewilligung ergänzt
- Bestands-U-Werte nach Bauperiode aus der aktuellen EAT-Tabelle eingebunden
- manuell gewählter Gebäudezustand kann die Bauperiode als Fallback übersteuern
- dezente Bestandsbewertung der U-Werte ergänzt
- Dokumentation auf Abschlussstand gebracht

## Gemeinsame Gebäudedaten

Neu:

```text
shared/data/building/existing-u-values.json
shared/data/building/envelope-evaluation.json
```

## Bauteil & Sanierung

- verbindliches Fachkonzept erstellt
- Mindestanforderungen nur als Warn-/Prüflogik
- Empfehlung, wirtschaftlicher Bereich und ambitionierter Standard
- Sowiesokosten, Förderung, CO₂ und Wohnkomfort definiert
- Haustechnik im Maßnahmenmodell berücksichtigt, aber fachlich getrennt

## Wirtschaftlichkeit

- gemeinsamer Core nach ÖNORM B 8110-4:2024 vorbereitet
- normatives Validierungsbeispiel Anhang A bestanden
- informative Beispiele Anhang B bestanden
- bestehende Excelmodelle gegen die Ausgabe 2024 abgeglichen
