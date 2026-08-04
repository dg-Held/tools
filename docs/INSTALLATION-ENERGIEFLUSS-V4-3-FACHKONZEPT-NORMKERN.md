# Installation – Energiefluss V4.3, Fachkonzept und Normkern

**Stand:** 04.08.2026

## 1. Vorher sichern

Den aktuellen Website-Hauptordner vollständig sichern. Optional ein wichtiges Projekt als JSON exportieren.

## 2. Dateien kopieren

Den gesamten Inhalt des entpackten Paketordners über den Website-Hauptordner kopieren und gleichnamige Dateien ersetzen lassen.

Die Ordnerstruktur im Paket entspricht bereits der Website-Struktur.

## 3. Browser neu laden

Energiefluss V4 öffnen und mit `Strg + F5` neu laden.

## 4. Testen

Den Testplan ausführen:

```text
docs/TESTPLAN-ENERGIEFLUSS-V4-3-UND-NORMCORE.md
```

Die automatischen Prüfungen können im Website-Hauptordner ausgeführt werden:

```bash
node tests/validate-building-data.js
node tests/validate-oenorm-b8110-4.js
```

## 5. Verschieben oder löschen

Es ist nichts zu verschieben oder zu löschen. Energiefluss V3 bleibt unverändert.

## Lizenzhinweis

Die vom Nutzer bereitgestellte ÖNORM-Datei ist aus Lizenzgründen nicht Bestandteil dieses Pakets. Im Paket befinden sich nur der daraus entwickelte Rechenkern, Tests und eigene Projektdokumentation.
