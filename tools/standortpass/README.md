# Standortpass – Schnittstellentest 07

## Ziel

Test 07 macht aus dem erfolgreichen Solar-Prototypen eine verständlichere Beratungsdarstellung und startet parallel die Suche nach einer öffentlichen TIRIS-Schnittstelle für den Wärmenetzkataster.

## Änderungen gegenüber Test 06

1. **Solar-Bezugshöhe**
   - Mit gewähltem Gebäude: TIRIS `GEB_HOEHE_MEDIAN` ist der Standard.
   - Ohne Gebäude oder ohne plausiblen Höhenwert: automatisch 2 m über Gelände.
   - Die 2-m-Ansicht bleibt bei Gebäuden nur als eingeklappter Detailvergleich verfügbar.

2. **DTM / DSM nutzerfreundlicher**
   - DTM = Digital Terrain Model = DGM / digitales Geländemodell.
   - DSM = Digital Surface Model = DOM / digitales Oberflächenmodell.
   - Darstellung: Grau = Gelände / Geländeverschattung.
   - Türkis = nur die zusätzliche Verschattung zwischen DTM und DSM, typischerweise Gebäude und Vegetation.
   - Die vollständigen DTM- und DSM-Horizontlinien werden weiterhin gezeichnet.
   - Minimale numerische Fälle `DSM < DTM` werden nur für die Grafik auf DTM begrenzt; Rohdaten bleiben unverändert.

3. **Sonnenbahnen**
   - Sommer, Frühling/Herbst und Winter bleiben in dieser Reihenfolge übereinander.
   - Verschattungsfarben sind nun klar von den Sonnenbahnfarben getrennt.

4. **Wärmeversorgung – Discovery**
   - Neuer Abschnitt `6 · Wärmeversorgung`.
   - Prüft den öffentlichen ArcGIS-Ordner `Service_Public`.
   - Prüft zusätzlich die bekannten Dienste `ogd_infrastruktur` und `ogd_raumordnung`.
   - Sucht nach Layer-/Dienstnamen mit Wärme-, Energie- oder Versorgungsbezug.
   - Noch keine Anschlussgebiets-Bewertung: zuerst muss der richtige öffentliche Layer eindeutig identifiziert werden.

## Test

1. Seite wie bisher über GitHub Pages öffnen.
2. Adresse wählen und Gebäude automatisch zuordnen.
3. Solarprofil laden. Standard muss bei vorhandenem Gebäude die Medianhöhe verwenden.
4. Prüfen, ob die Grafik intuitiv lesbar ist:
   - graue Fläche = Gelände,
   - transparente türkise Zusatzfläche = Gebäude / Vegetation,
   - Sonnenbahnen klar davon getrennt.
5. Optional `Detailvergleich: Bezugshöhe ändern` öffnen und 2 m testen.
6. Im Abschnitt Wärmeversorgung `TIRIS-Wärmedienste suchen` drücken.
7. Bei Treffern bitte die sichtbaren Layernamen sowie den Rohdatenblock `TIRIS Wärmenetz-Suche` kopieren.

## Hinweis zu „Fernverschattung“

Der Begriff ist für Privatpersonen anschaulich, fachlich ist DTM aber der **Geländehorizont**. Auch ein naher Hang kann Teil davon sein. Deshalb verwenden wir in Erklärungen bevorzugt `Gelände / Fernverschattung`, technisch bleibt `DTM/DGM`.
