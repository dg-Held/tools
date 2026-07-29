# Standortpass – Schnittstellentest 13

Test 13 baut auf dem bestätigten Stand von Test 12 auf.

Neu:

1. **Solar-Dachfokus geometrisch synchronisiert:** Die normale Gebäudeübersicht bleibt bei ca. **1:500 / 80 m**. Der Solarblock verwendet unabhängig davon ca. **1:250 / 40 m**. Orthofoto, Solar-WMS und Gebäudekontur werden im Solarblock mit **derselben Bounding Box in EPSG:31254** geladen. Damit sollen Dachkontur und Solarbild deckungsgleich sein.
2. **Eigene Projektionsgeometrie für Solar:** Das bestätigte Gebäude wird für den Solarblock nochmals direkt aus dem TIRIS-Gebäude-FeatureServer in EPSG:31254 geladen. Die 1:250-Box wird in Metern um das Gebäude gebildet; nur bei großen Gebäuden wird automatisch erweitert.
3. **Radon-Gebietsstatus:** Die vorhandene Gemeindekennziffer wird gegen Anlage 1 der Radonschutzverordnung geprüft. Alle Tiroler Gemeinden werden als Radonvorsorgegebiet gekennzeichnet; die zusätzlich definierten Tiroler Radonschutzgebiete werden über ihre GKZ erkannt.

## Einbau

Die vier Dateien direkt nach `tools/standortpass/` kopieren und die Dateien aus Test 12 ersetzen.

## Besonders prüfen

### Solar
- Gebäudeübersicht weiter oben weiterhin **1:500**.
- Solar-Dachfokus **1:250 / 40 m**.
- Orthofoto und Solarstrahlung liegen nun exakt übereinander.
- Gebäudekontur deckt sich mit dem Orthofoto und dem eingeblendeten Solarbereich.
- Bei großen Gebäuden darf der Ausschnitt automatisch wachsen.

### Radon
- `Bürgerstraße 1, 6020 Innsbruck` sollte als **Radonvorsorgegebiet = ja** und **Radonschutzgebiet = nein** erscheinen.
- Für einen Standort in einer der gesetzlich ausgewiesenen Tiroler Radonschutzgemeinden sollen beide Angaben `ja` sein.

## Fachlicher Hinweis Radon

Der Gebietsstatus ist ein amtlicher Standortindikator. Er sagt nicht aus, welche Radonkonzentration tatsächlich in einem konkreten Gebäude vorliegt und ersetzt keine Messung.
