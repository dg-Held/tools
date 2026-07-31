# Klima & Heizlast – Freigabe V1.2

**Stand:** 31.07.2026  
**Version:** 1.2.0

## Zweck dieses Updates

Version 1.2 ändert **nicht** die fachliche Heizlast- oder Klimaauswertungslogik. Das Update betrifft Wartbarkeit, Datenquellen und die gemeinsame Projektarchitektur.

## Freigegebene Änderungen

### Adresse

- BEV-Stichtagsdaten bleiben als schnelle lokale Vorschlagsquelle erhalten.
- Nach Auswahl eines Vorschlags erfolgt ein Live-Abgleich gegen TIRIS `ogd_basis`.
- Bevorzugte Zuordnung über ADRCD; Fallback über PLZ/Hausnummer und Plausibilisierung.
- Fällt TIRIS aus, bleibt die BEV-Adresse als gekennzeichneter Fallback nutzbar.
- Vollständige TIRIS-Suche kann einspringen, wenn der lokale BEV-Index keinen Vorschlag liefert und PLZ + Hausnummer vorhanden sind.

Damit bleibt die komfortable Autovervollständigung erhalten, während die tatsächlich verwendete Adresse nach Möglichkeit aus der aktuellen TIRIS-Sicht stammt.

### Ausdruck

Der Seitenhintergrund wird im Druck explizit auf Weiß gesetzt. Dadurch entstehen zwischen gemeinsamer Kopfzeile und Bericht sowie unter dem letzten Block keine farbigen Streifen der Weboberfläche.

### INCA – jahresweise Wartung

Vorbereitet ist eine neue Paketstruktur:

```text
data/climate-precomputed/yearly/
  index.json
  <Jahr>.json
  <Jahr>/<Kachel>.json
```

Mitgeliefert werden:

- `tools/INCA_JAHR_AUFBEREITEN.bat`
- `tools/inca_year_precompute.py`

Die BAT verarbeitet die Monats-NetCDF-Dateien eines Kalenderjahres und aktualisiert die Jahrespakete sowie `manifest.json`.

Die Umstellung wird erst aktiv, wenn der bisherige Basiszeitraum lückenlos als Jahrespakete vorliegt. Danach wird ein neues abgeschlossenes Jahr nur noch ergänzt; alte Jahre müssen nicht neu berechnet werden.

Die aktuelle Webanzeige des Klimazeitraums wird nach Aktivierung automatisch aus `manifest.json` befüllt.

## Unverändert

- `climate-core.js` – fachliche Live-Auswertung
- `heating-core.js` – vereinfachte Heizlast
- OIB NAT / TNAT,13 Logik
- gemeinsame Projekt-/Kopfzeilenlogik aus V1.1
- Live-GeoSphere als Rückfallweg

## Übergangsphase

Der Standortpass wird **erst im nächsten Arbeitsschritt** auf die neuen gemeinsamen Adressservices umgestellt. Bis dahin bleiben die bereits vorhandenen Kompatibilitätsbrücken im Klima-Ordner bestehen.

Nach der Standortpass-Umstellung sind diese Brücken und überholte Altdateien zu entfernen. Dies ist Teil des geplanten Architekturabschlusses und kein optionaler Restpunkt.

## Prüfpunkte vor Veröffentlichung

1. BEV-Autocomplete bei Teiltexteingabe prüfen, z. B. `6112 w`.
2. Einen Vorschlag auswählen und TIRIS-Liveauflösung kontrollieren.
3. Schreibweisenabweichung testen, z. B. BEV-Langbezeichnung gegen kürzere TIRIS-Adresse.
4. TIRIS-Ausfall simulieren / Fallback-Hinweis prüfen.
5. Ausdruck in Firefox und Chromium auf weißen Seitenhintergrund prüfen.
6. Jahresgenerator zunächst mit einem Testjahr ausführen und Ausgabemanifest kontrollieren.
7. Jahrespakete erst nach Plausibilisierung und vollständiger Basismigration aktiv verwenden.
