# Standortpass – Schnittstellentest 06

Dieser Test baut auf Test 05 auf und verändert die bestehenden Tools weiterhin nicht.

## Neu in Test 06

1. Die erfolgreiche TIRIS-Live-Adresse bleibt Primärquelle; BEV bleibt nur Vergleich/Fallback.
2. Orthofoto bleibt standardmäßig auf ca. 1:500 / 80 m Bodenbreite.
3. GeoLand/voibos wird nun mit einem festen Referenzdatum `03-20-12:00` abgefragt. Dadurch kann die zurückgegebene Sonnenbahn als Frühling-/Herbst-Referenz zusammen mit Sommer- und Wintersonnenwende dargestellt werden.
4. Aus allen 360 Horizontwerten wird ein eigenes SVG gezeichnet:
   - Geländehorizont DTM
   - Oberflächenhorizont DSM
   - Sonnenbahn Sommer
   - Sonnenbahn Frühling/Herbst
   - Sonnenbahn Winter
5. Bezugshöhe für Solar ist testweise wählbar:
   - **Dachniveau automatisch**: bei gewähltem Gebäude wird `GEB_HOEHE_MEDIAN` verwendet.
   - **2 m über Gelände**: für Vergleich bzw. Standorte ohne Gebäude.
6. Die technischen Rohdaten bleiben vollständig einklappbar.

## Einbau

Die vier Dateien in `tools/standortpass/` ersetzen:

- `index.html`
- `schnittstellentest.css`
- `schnittstellentest.js`
- `README.md`

`tools/klima-heizlast/` bleibt unverändert und wird weiterhin nur für BEV-Vergleich/Fallback und DGM-Funktion genutzt.

## Empfohlener Test

1. Adresse über **TIRIS live suchen**.
2. Gebäude automatisch zuordnen.
3. Orthofoto bei **ca. 1:500 · 80 m** kontrollieren.
4. Im Solarbereich **Dachniveau automatisch** belassen und **Solarprofil laden**.
5. Prüfen, ob das SVG plausibel aussieht:
   - N / O / S / W richtig angeordnet,
   - Sommerbahn am höchsten,
   - Winterbahn am niedrigsten,
   - DTM und DSM als getrennte Horizonte sichtbar.
6. Danach testweise auf **2 m über Gelände** umstellen. Bei dichter Bebauung sollte sich vor allem der DSM-Horizont merklich verändern.
7. Bei Auffälligkeiten bitte den Solarbereich und den Rohdatenblock „GeoLand Sonnenstand“ kopieren.

## Noch keine endgültige Fachlogik

Die automatische Verwendung der TIRIS-Medianhöhe als Solar-Bezugshöhe ist in Test 06 bewusst eine Prüfannahme. Erst der Vergleich mehrerer Gebäude entscheidet, ob sie für die endgültige Standortpass-Ausgabe verwendet wird.
