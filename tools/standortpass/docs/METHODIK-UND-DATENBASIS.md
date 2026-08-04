# Standortpass Energie & Gebäude – Methodik und Datenbasis

**Stand:** 04.08.2026  
**Charakter:** Automatisierte Standortvorprüfung und überschlägige Gebäudeorientierung

## 1. Zweck

Der Standortpass bereitet nach Auswahl einer Adresse möglichst viele amtliche oder nachvollziehbar abgeleitete Standortinformationen für eine Energieberatung auf. Er ersetzt weder Vermessung, Einreichplanung, Behördenauskunft noch eine fachliche Detailprüfung.

## 2. Ablauf

```text
Adresse
  ↓
BEV-Vorschlag und TIRIS-Live-Abgleich
  ↓
Gebäudezuordnung automatisch oder manuell bestätigt
  ↓
Geometrie, Höhe und Gebäudeschätzungen
  ↓
Wärmeversorgung, Solar, Standort und Risiken
  ↓
kompakter Bericht mit Quellen und Methodik
```

## 3. Datenpriorität

```text
manuell bestätigt → amtlich automatisch → abgeleitet → Fallback
```

Automatische Ausgangswerte bleiben auch nach einer manuellen Korrektur erhalten. Der wirksame Wert ist in allen Tools derselbe Projektwert.

## 4. Gebäudezuordnung

Der Standortpass sucht TIRIS-Gebäude im Umfeld der Adresse. Bei eindeutiger Zuordnung wird das Gebäude automatisch verwendet; bei mehreren Kandidaten kann ein Gebäude manuell bestätigt werden. Der gespeicherte Quellen-Snapshot enthält Objekt-ID, Auswahlart, Polygon und Attribute.

## 5. Geometrie und Gebäudeabschätzungen

Amtliche beziehungsweise aus TIRIS abgeleitete Ausgangswerte können umfassen:

- Dachprojektion/Grundfläche,
- Umfang,
- Medianhöhe und Maximalhöhe,
- Dachneigung und Dachschräge,
- Außenwand-, Fenster-, OGD-/Dach- und Kellerdeckenfläche,
- Gebäudevolumen.

### 5.1 Geschosse

```text
Geschosse ≈ Medianhöhe / 3,2 m
```

Das Ergebnis wird bewusst auf eine ganze Zahl gerundet. Halbgeschosse werden in dieser ersten Orientierung nicht modelliert.

### 5.2 Bruttogeschoßfläche

```text
BGF ≈ Dachprojektion × verwendete oberirdische Geschosse
```

Die automatische BGF wird auf 10 m² gerundet.

### 5.3 Nutzfläche

```text
NFL ≈ BGF × 0,75
```

Der Faktor 0,75 ist eine überschlägige Annahme ausgehend von der Dachprojektion und ersetzt keine Flächenberechnung nach Planunterlagen. Die automatische NFL wird auf 5 m² gerundet.

### 5.4 Beheizte Nutzfläche

Die beheizte Nutzfläche bleibt ein eigener Wert. Die automatische NFL dient als erste Ausgangsannahme, wird aber nicht bei jeder Änderung von BGF oder NFL automatisch als bestätigte beheizte Fläche überschrieben. Eine Nutzerangabe aus Standortpass, Heizlast oder Energiefluss hat projektweit Vorrang.

### 5.5 Rundungen

Um Scheingenauigkeit zu vermeiden, werden überschlägige Hüllflächen typischerweise wie folgt dargestellt und gespeichert:

- Außenwand, OGD/Dach, Kellerdecke/Boden, BGF, Dachschräge und Volumen: geeignete grobe Schrittweite, überwiegend 10 m² beziehungsweise 10 m³,
- Fenster: 5 m²,
- Geschosse: ganze Zahl,
- Dachneigung: gerundete Orientierung.

Der amtliche oder rechnerische Rohwert bleibt im Quellenfeld nachvollziehbar.

## 6. Wärmeversorgung

Der Bericht prüft beziehungsweise verlinkt, soweit öffentlich erreichbar:

- Wärmenetz-Hinweise,
- Erdwärmesonden,
- Bewilligungspflicht für Tiefensonden,
- Grundwasserentnahmen/-rückgaben,
- Schutz- und Schongebiete,
- Grundwassermessstellen,
- Wasserbuch-/Wasserinfo-Angebote.

Nicht öffentlich erreichbare TIRIS-Inhalte werden als Direktlink oder offene Schnittstellenlücke gekennzeichnet.

## 7. Solar

Der Standortpass verwendet unter anderem:

- Sonnenbahn/GeoLand- beziehungsweise voibos-Bezug,
- DTM-Geländeverschattung,
- DSM-Zusatzverschattung durch Gebäude und Vegetation,
- TIRIS-Medianhöhe als Standard-Bezugshöhe,
- Sonnenscheindauer,
- Jahressolarstrahlung im Standortumfeld.

Die Umfeldstrahlung ist kein gebäudescharfes Dachsolarpotential. Das in tirisMaps sichtbare gebäudebezogene Solarpotential bleibt verlinkt, solange kein verlässlich zugänglicher öffentlicher Dienst verfügbar ist.

## 8. Standort und Risiken

Je nach Datenverfügbarkeit werden geprüft:

- Denkmalschutz/BDA und TIRIS-Kulturkontext,
- HQ30, HQ100 und HQ300,
- weitere Naturgefahren und WLV-Planungsbereiche,
- Radonschutz- und Radonvorsorgegebiete.

Naturgefahrenabfragen laufen mit begrenzter Parallelität. Das beschleunigt den Bericht, ohne den externen Dienst mit allen Anfragen gleichzeitig zu belasten.

## 9. Druck und Dokumentation

Der Ausdruck ist auf zwei verdichtete A4-Seiten ausgelegt. Herkunft, automatische Ableitung und manuelle Korrektur müssen unterscheidbar bleiben. Formeln, Quellen, Rundungen und Grenzen stehen im eingeklappten Methodikbereich und in dieser Dokumentation.
