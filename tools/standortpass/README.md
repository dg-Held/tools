# Standortpass – Schnittstellentest 10

Test 10 lässt die bisher funktionierenden Module unverändert weiterlaufen und ergänzt **Hochwasser + Naturgefahren**.

## Umweltwärme – fachliche Einordnung

Die Detaildaten bleiben bewusst reichhaltig, sollen im späteren Ausdruck aber verdichtet werden.

- **Erdwärmesonden**: bestehende Tiefensonden im Umfeld; Indiz, keine Eignungszusage.
- **Bewilligungspflicht Tiefensonden**: rechtlicher Flächenhinweis; bei Treffer sehr relevant.
- **Grundwasserentnahmen / -rückgaben**: zeigen bestehende Wassernutzungen. Nicht jede Entnahme ist thermisch und nicht jede Entnahme besitzt eine eigene Rückgabe.
- **Grundwasser-Sonden / Beobachtung**: Grundwasser-Erkundungs-/Beobachtungspunkte, nicht automatisch Wärmepumpenanlagen.
- **Schutz-/Schongebiete / Beschränkungen**: für Grundwasser- und Tiefensondennutzung besonders relevant.
- **Grundwasser-Messstellen**: für vertiefte Planung interessant; im Kunden-Ausdruck nur bei konkretem Mehrwert.

## Neu: Hochwasser HQ30 / HQ100 / HQ300

Direkte öffentliche BWV-FeatureServices:

- `Ueberflutungsflaechen_HQ30`
- `Ueberflutungsflaechen_HQ100`
- `Ueberflutungsflaechen_HQ300`

Wenn ein TIRIS-Gebäude gewählt wurde, wird das **gesamte Gebäudepolygon** auf Schnitt mit der jeweiligen Überflutungsfläche geprüft. Ohne Gebäude wird der Standortpunkt verwendet.

Wichtig: `kein Treffer` wird nur als **kein Treffer in den ausgewerteten Daten** formuliert, niemals als `sicher`.

## Neu: weitere Naturgefahren

Quelle:

`Service_Public/ogd_naturgefahren/MapServer`

Test 10 liest die aktuellen Layer dynamisch und prüft relevante polygonale Gefahren-, Hinweis- und Funktionsflächen, z. B. Wildbach, Lawine, Gefahrenzonen, Hinweisbereiche oder weitere Naturgefahren, soweit sie im öffentlichen Dienst vorhanden sind.

Nur positive Treffer werden prominent angezeigt. Alle geprüften Layer bleiben in einem aufklappbaren technischen Bereich sichtbar.

## Installation

Die vier Dateien in `tools/standortpass/` ersetzen:

- `index.html`
- `schnittstellentest.css`
- `schnittstellentest.js`
- `README.md`

`tools/klima-heizlast/` bleibt unverändert.

## Testhinweise

1. Adresse wählen.
2. Gebäude automatisch zuordnen, wenn vorhanden.
3. `Hochwasser & Naturgefahren prüfen`.
4. Prüfen, ob HQ30/HQ100/HQ300 jeweils einen nachvollziehbaren Treffer/Kein-Treffer liefern.
5. Positive Naturgefahren-Treffer und die Liste der geprüften Layer kopieren.
6. Einen Standort ohne Gebäude testen: dort muss automatisch der Punkt-Fallback verwendet werden.
