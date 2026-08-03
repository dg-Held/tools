# INCA-Jahrespakete erzeugen

## Wofür?

Nach der einmaligen Migration des bisherigen Basiszeitraums wird jedes neue abgeschlossene INCA-Kalenderjahr separat ergänzt. Alte Jahre müssen danach nicht erneut berechnet werden.

## Eingabe

Ein Ordner mit den NetCDF-Dateien des Zieljahres, typischerweise 12 Monatsdateien. Entscheidend sind die enthaltenen Zeitstempel und die Variable `T2M`, nicht der Dateiname.

Beispiel:

```text
C:\INCA\2026\
  ... Januar ... .nc
  ... Februar ... .nc
  ...
  ... Dezember ... .nc
```

## Start

Im Explorer oder in der Eingabeaufforderung:

```text
INCA_JAHR_AUFBEREITEN.bat 2026 "C:\INCA\2026"
```

Beim ersten Start wird neben dem Skript unter `tools/klima/tools/.venv_inca/` eine lokale Python-Umgebung erstellt. Dafür wird einmalig Internetzugang benötigt, um `numpy`, `xarray` und `netCDF4` zu installieren.

## Ausgabe

```text
shared/data/climate/inca/
  manifest.json
  yearly/
    index.json
    2026.json
    2026/
      <tile>.json
      ...
```

Die Kacheln sind Absicht: Der Browser lädt später je Standort nur die benötigte Kachel des jeweiligen Jahres statt einer sehr großen Tirol-Gesamtdatei.

## Einmalige Migration

Vor der ersten Aktivierung müssen die bisherigen Basisjahre vollständig als Jahrespakete vorliegen. Am besten chronologisch erzeugen:

```text
2012, 2013, 2014, ... 2025
```

Danach kann 2026, 2027 usw. jeweils einzeln angehängt werden.

Die chronologische Reihenfolge hat einen fachlichen Vorteil: Für Tropennächte speichert jedes Paket die sechs Abendstunden des 31. Dezember. Das Folgejahr kann damit die Nacht zum 1. Jänner vollständig bewerten. Nur beim allerersten Basisjahr kann diese eine Nacht ohne Vorjahrespaket unvollständig bleiben.

## Automatische Aktivierung

Das Skript unterscheidet:

- `available_years`: bereits erzeugte Pakete
- `years`: lückenlos aktiver Zeitraum
- `enabled`: Jahrespakete vollständig genug für die Runtime

Ein Jahr mit Lücke wird nicht verworfen, aber erst aktiv, sobald die fehlenden Zwischenjahre ergänzt wurden.

Nach Aktivierung liest die Website den Zeitraum aus `manifest.json`. Anzeigen, Diagramme und Exportzeitraum ändern sich damit automatisch.

## Sicherheit

Das Skript überschreibt nur das ausdrücklich gewählte Jahrespaket und aktualisiert die Manifeste. Bestehende Altjahre werden nicht gelöscht. Die bisherige Runtime bleibt aktiv, bis der Basiszeitraum vollständig migriert ist.
