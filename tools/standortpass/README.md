# Standortpass – Schnittstellentest 04

## Ziel

Test 04 schließt die gemeinsame Adress-/Gebäudebasis weiter ab.

Neu gegenüber Test 03:

1. **Flexible TIRIS-Live-Adresssuche**
   - Groß-/Kleinschreibung egal
   - Komma nicht erforderlich
   - Reihenfolge von Straße/Gemeinde darf variieren
   - serverseitige Eingrenzung über PLZ + Hausnummer
   - clientseitiges Ranking über Straße/Gemeinde
2. **Katastralgemeinde weiterhin direkt aus TIRIS Layer 39**
3. **BEV weiterhin nur Vergleich/Fallback**
4. **Gebäude nur bei direktem Polygon-Treffer automatisch wählen**
5. **Orthofoto-Ausschnitt wählbar**
   - ca. 1:250 = 40 m Bodenausschnitt
   - ca. 1:500 = 80 m Bodenausschnitt (Standard)
   - ca. 1:750 = 120 m Bodenausschnitt

Die Maßstabsangaben sind für eine spätere Druckbreite von 160 mm gedacht. Im Browser ist die physische Bildschirmdarstellung nicht maßstabsgetreu, aber der Bodenausschnitt bleibt definiert.

## Besonders testen

Dieselbe Adresse bitte in mehreren Schreibweisen:

- `Karwendelweg 9, 6123 Terfens`
- `karwendelweg 9 6123 terfens`
- `6123 TERFENS Karwendelweg 9`
- `Hirschenkreuz 11A 6130 SCHWAZ`
- `6130 Schwaz hirschenkreuz 11a`

Danach prüfen, ob ADRCD, Koordinate und KGNR identisch bleiben.

Beim Orthofoto bitte 1:250 / 1:500 / 1:750 vergleichen. Standardziel für die spätere Kundenansicht ist vorerst **1:500**.
