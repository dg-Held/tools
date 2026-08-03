# Installation – Grundumbau Pakete 1–4

## Vorher

1. Sicherheitskopie des gesamten Website-Ordners erstellen.
2. In Standortpass bzw. Klima/Heizlast wichtige Projekte als JSON exportieren.
3. Die Website lokal über einen Webserver testen, nicht nur per Doppelklick.

## Dateien aus dem ZIP übernehmen

Den Inhalt des gelieferten Ordners direkt über den Website-Hauptordner kopieren.
Vorhandene gleichnamige Dateien ersetzen. Große Adress- und Klimadateien sind
nicht nochmals im ZIP enthalten.

## Einmalig manuell verschieben

### 1. INCA-Daten

Gesamten Ordner verschieben:

```text
VON:
tools/klima-heizlast/data/climate-precomputed/

NACH:
shared/data/climate/inca/
```

Es müssen danach insbesondere vorhanden sein:

```text
shared/data/climate/inca/manifest.json
shared/data/climate/inca/yearly/index.json
shared/data/climate/inca/yearly/2012/
...
shared/data/climate/inca/yearly/2025/
```

Der Ordner `tiles/` bleibt als bestehende Rückfallebene ebenfalls erhalten.

### 2. OIB-Daten

Die vier kleinen OIB-Dateien sind bereits im ZIP am endgültigen Platz enthalten:

```text
shared/data/standards/oib/
```

Der alte Ordner `tools/klima-heizlast/data/oib/` wird daher nicht mehr benötigt.

### 3. Adressdaten

Die vorhandenen großen Dateien bleiben unverändert unter:

```text
shared/data/addresses/
```

Sie müssen nicht erneut hochgeladen werden.

## Erst nach erfolgreichem Test löschen

```text
tools/klima-heizlast/
```

Nicht vorher löschen. Zuerst müssen beide neuen Seiten funktionieren:

```text
tools/klima/index.html
tools/heizlast/index.html
```

## GitHub-Hinweis für den großen INCA-Ordner

Bei einem bereits vorhandenen Repository ist ein lokales Verschieben mit
GitHub Desktop oder Git empfehlenswert. Git kann identische Dateien als
Verschiebung erkennen; der Web-Uploader mit seiner Datei-/Größenbegrenzung ist
für diesen einmaligen Umbau ungeeignet.

## Nicht verschieben oder löschen

```text
shared/data/addresses/
tools/energiefluss/          (V3 bleibt unverändert)
tools/standortpass/          (nur die gelieferten Dateien überschreiben)
```
