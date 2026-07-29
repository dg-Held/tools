# Standortpass – Schnittstellentest 05

Dieser Test baut auf Test 04 auf und verändert die bestehenden Tools weiterhin nicht.

## Neu in Test 05

1. Quellenanzeige der TIRIS-Live-Adresse korrigiert (`tiris-live` wurde in Test 04 fälschlich als „BEV Fallback“ beschriftet).
2. Orthofoto-Ausschnitt sichtbar wählbar; Standard ist ca. 1:500 bzw. 80 m Bodenbreite.
3. Erster GeoLand/voibos-Schnittstellentest für Sonnenstand:
   - WGS84 / EPSG:4326
   - Beobachtungshöhe 2 m
   - `Output=JSONDownload`
   - Prüfung auf Horizontwerte (DTM/DSM), Datengrundlage, Befliegungsjahr und theoretische Sonnenscheindauer.

## Einbau

Die vier Dateien in `tools/standortpass/` ersetzen:

- `index.html`
- `schnittstellentest.css`
- `schnittstellentest.js`
- `README.md`

`tools/klima-heizlast/` bleibt unverändert und wird weiterhin nur für BEV-Vergleich/Fallback und DGM-Funktion genutzt.

## Empfohlener Test

1. `6020 bürgerstraße 1` über **TIRIS live suchen**.
2. Prüfen, ob beim gemeinsamen Standort nun **TIRIS live** steht.
3. Gebäude automatisch zuordnen; Orthofoto auf **ca. 1:500 · 80 m** belassen.
4. **GeoLand Sonnenstand prüfen**.
5. Bei Erfolg sind besonders interessant:
   - `abfragestatus`
   - `datengrundlage`
   - `flugjahr`
   - Anzahl Horizontwerte
   - DTM/DSM-Werte bei 0°, 90°, 180°, 270°
   - Sonnenscheindauer je Monat
6. Bei Fehler bitte Fehlermeldung und Rohdatenblock „GeoLand Sonnenstand“ kopieren. Ein CORS-Fehler wäre ebenfalls ein verwertbares Testergebnis.
