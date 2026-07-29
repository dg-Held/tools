# Standortpass – Schnittstellentest 02

## Zweck

Zweite technische Teststufe für die gemeinsame Standortbasis.

Geprüft werden:

1. bestehendes BEV-Adressmodul aus `tools/klima-heizlast/`
2. TIRIS BASIS Service-Metadaten (`ogd_basis`)
3. ausgewählte TIRIS-Adress-Punktlayer: Felder + räumliche Abfrage am Standort
4. TIRIS Gebäude FeatureServer
5. automatische Gebäudezuordnung per BEV-Gebäudekoordinate im Dachpolygon
6. Fallback auf 15 m bzw. gewählten Umkreis, wenn kein direkter Polygon-Treffer vorliegt
7. optionaler Vergleich von TIRIS-Geometrie gegen bekannte Gebäudeabmessungen
8. bestehende TIRIS-DGM-Höhenabfrage aus `tools/klima-heizlast/location-core.js`

Noch nicht enthalten:

- Sonnenstand / GeoLand
- Fern-/Nahwärme
- Wasser / Hochwasser
- regionale Klimaanalyse
- fertige Standortpass-Oberfläche
- freigegebene Ableitung der Fassadenhöhe oder Wandfläche

## Einbau

Den Inhalt dieses Ordners als

`tools/standortpass-test/`

in dieselbe Website kopieren, in der bereits

`tools/klima-heizlast/`

liegt.

Die Testseite verwendet weiterhin bewusst die vorhandenen Dateien:

- `../klima-heizlast/address-provider-core.js`
- `../klima-heizlast/address-provider-bev-local.js`
- `../klima-heizlast/location-core.js`
- `../klima-heizlast/data/addresses/...`

Dadurch wird die bestehende Logik nicht kopiert.

## Testreihenfolge

1. Seite über GitHub Pages bzw. einen lokalen Webserver öffnen.
2. Adresse suchen und auswählen.
3. `TIRIS BASIS prüfen` anklicken.
4. `TIRIS-Adresslayer prüfen` anklicken und Feldnamen/Rohdaten notieren.
5. `Gebäude automatisch zuordnen` anklicken.
6. Prüfen, ob ein direkter Punkt-in-Polygon-Treffer erfolgt.
7. Nur bei Bedarf `Umgebung laden` verwenden.
8. Bei einem bekannten Gebäude Vergleichswerte eintragen und `Vergleich berechnen` anklicken.
9. `Geländehöhe prüfen` anklicken.
10. In Firefox/Chromium F12 → Netzwerk kontrollieren, ob die Aufrufe ohne CORS-Fehler funktionieren.

## Wichtig

Die Testableitung

`Außenwand brutto = Shape__Length × GEB_HOEHE_MEDIAN`

ist weiterhin **keine freigegebene Standortpass-Methodik**.

Der neue Vergleichsblock dient nur dazu, an mehreren bekannten Gebäuden systematisch festzustellen:

- wie stark das TIRIS-Dachpolygon durch Dachüberstände größer als der Wandgrundriss ist,
- wie gut `GEB_HOEHE_MEDIAN` als Gebäudeorientierung funktioniert,
- ob die einfache Wandableitung systematische Abweichungen zeigt.

Die angezeigte Näherung

`Dachüberstand ≈ (Dachumfang − Fassadenumfang) / 8`

ist nur für ungefähr rechteckige Gebäude mit annähernd gleichmäßigem Dachüberstand gedacht und **keine allgemeine Berechnungsregel**.
