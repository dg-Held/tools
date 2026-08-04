# INCA-Jahrespakete erzeugen und warten

**Stand:** 04.08.2026

## Zweck

Nach der einmaligen Migration des Basiszeitraums wird jedes neue abgeschlossene INCA-Kalenderjahr separat ergänzt. Alte Jahre müssen danach nicht erneut berechnet werden.

## Eingabe

Ein Ordner mit den NetCDF-Dateien des Zieljahres, typischerweise zwölf Monatsdateien. Entscheidend sind die enthaltenen Zeitstempel und die Variable `T2M`, nicht der Dateiname.

```text
INCA_JAHR_AUFBEREITEN.bat 2026 "C:\INCA\2026"
```

Beim ersten Start wird unter `tools/klima/tools/.venv_inca/` eine lokale Python-Umgebung erstellt. Dafür wird einmalig Internetzugang zur Installation der Python-Pakete benötigt.

## Ausgabe

```text
shared/data/climate/inca/
├── manifest.json
└── yearly/
    ├── index.json
    ├── 2026.json
    └── 2026/
        └── <tile>.json
```

Die Kacheln sind beabsichtigt: Je Standort wird nur die relevante Kachel jedes Jahres geladen.

## Aktivierung

Das Skript unterscheidet:

- `available_years`: bereits erzeugte Pakete,
- `years`: lückenlos aktiver Zeitraum,
- `enabled`: Jahrespakete vollständig genug für die Runtime.

Ein Jahr hinter einer Lücke wird nicht verworfen, aber erst nach Ergänzung der fehlenden Zwischenjahre aktiv.

## Jahreswechsel und Tropennächte

Jedes Paket speichert die benötigten Abendstunden des 31. Dezember. Dadurch kann das Folgejahr die Nacht zum 1. Jänner vollständig bewerten. Nur beim ersten Basisjahr kann diese eine Nacht ohne Vorjahrespaket unvollständig bleiben.

## Pflichtprüfung nach einem neuen Jahr

1. `manifest.json` enthält das neue Jahr.
2. `yearly/index.json` bleibt gültig.
3. Jahresmanifest und Kacheln sind vorhanden.
4. Klima zeigt den erweiterten Zeitraum.
5. Jahreslinie und Kennwerte enthalten das neue Jahr.
6. Heizlast lädt weiterhin denselben Zeitraum.
7. Energiefluss V4.2 kann über „Klimawerte berechnen“ denselben Zeitraum erzeugen.
8. Ein Projekt mit bestehendem Klima-Snapshot wird nach Neuberechnung aktualisiert.
9. Stichprobe an mindestens zwei Standorten und Höhenlagen durchführen.

## Sicherheit

Das Skript überschreibt nur das ausdrücklich gewählte Jahrespaket und aktualisiert die Manifeste. Bestehende Altjahre werden nicht gelöscht. Vor der Veröffentlichung Manifest und neues Jahrespaket gemeinsam hochladen.
