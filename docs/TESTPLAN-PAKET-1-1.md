# Testplan – Stabilisierungspaket 1.1

## 1. Allgemeiner Start

1. `tools/klima/index.html` öffnen.
2. `tools/heizlast/index.html` öffnen.
3. `tools/standortpass/index.html` öffnen.
4. Prüfen, ob Projektname, Projekt-ID und Adresse weiterhin übernommen werden.
5. Bei veraltetem Aussehen einmal `Strg + F5` verwenden.

## 2. Klima drucken

1. Bekannte Adresse auswählen und Klima auswerten.
2. Oben oder unten `Drucken / PDF` wählen.
3. Prüfen:
   - nur eine gefüllte A4-Seite
   - keine zweite leere Seite
   - Titel `Klima am Standort` liegt mit Abstand unter der Projektkopfzeile
   - Diagramm und Quellenhinweis sind vollständig sichtbar

## 3. Heizlast und Heizgrenze

1. Adresse und Klimagrundlage laden.
2. Verbrauch und beheizte Nutzfläche eingeben.
3. Rechts bei `Vorhandene Heizung` den Vorschlag zur Heizgrenztemperatur prüfen.
4. Heizgrenze manuell ändern, zum Beispiel auf 13,5 °C.
5. Seite neu laden und prüfen, ob 13,5 °C erhalten bleibt.
6. `Vorschlag` drücken und prüfen, ob der automatische Wert wieder verwendet wird.
7. Drucken/PDF prüfen:
   - Heizlast steht oben und im Vordergrund
   - Klimagrundlage steht klein am Ende
   - Ausdruck passt im Regelfall auf eine A4-Seite

## 4. Gebäudeauswahl speichern

Empfohlene Testadresse:

`St. Johann im Walde 102, 9952 St. Johann im Walde`

1. Adresse im Standortpass auswählen.
2. Gebäude manuell über die Umgebungssuche zuordnen.
3. Sichtbare Geometriewerte bei Bedarf korrigieren.
4. Seite neu laden.
5. Prüfen, ob dasselbe Gebäude samt Polygon wieder ausgewählt ist.
6. Projekt als JSON exportieren.
7. Projekt zurücksetzen und JSON wieder importieren.
8. Prüfen, ob Gebäudeauswahl und manuelle Korrekturen wiederhergestellt werden.

## 5. Geschosse, BGF, NFL und beheizte Nutzfläche

1. Ein Gebäude mit Medianhöhe auswählen.
2. Prüfen:
   - Geschoße erscheinen nur als ganze Zahl
   - Höhenmodul steht standardmäßig auf 3,2 m
   - Nutzflächenfaktor steht standardmäßig auf 75 %
   - BGF = Dachprojektion × Geschoße
   - NFL = ungefähr 75 % der BGF
3. Manuell `2,6` Geschoße eingeben und das Feld verlassen.
4. Prüfen, ob daraus bewusst `3` wird.
5. Eine beheizte Nutzfläche manuell eingeben.
6. Zum Heizlasttool wechseln und prüfen, ob derselbe Wert verwendet wird.
7. Dort einen anderen Wert eingeben und zum Standortpass zurückkehren.
8. Prüfen, ob der neue manuelle Projektwert im Standortpass erscheint und die automatische NFL-Schätzung weiterhin als Ursprung erhalten bleibt.

## 6. Naturgefahren

1. Eine bekannte Adresse vollständig prüfen.
2. Den Fortschritt `prüft x/y` beobachten.
3. Prüfen, ob HQ30/HQ100/HQ300 und die weiteren Gefahrenkarten vollständig erscheinen.
4. Die Laufzeit sollte gegenüber der streng sequenziellen Variante spürbar kürzer sein; die tatsächliche Dauer hängt weiterhin vom TIRIS-Dienst ab.

## 7. Rückwärtskontrolle

- Solarstrahlung und Orthofoto funktionieren unverändert.
- Standortpass-Druck umfasst weiterhin zwei Seiten.
- Klima-Jahrespakete werden weiterhin aus `shared/data/climate/inca/` geladen.
- Energiefluss V3 funktioniert unverändert.
