# Standortpass – Schnittstellentest 14

Test 14 baut auf dem bestätigten Stand von Test 13 auf.

Neu:

1. **Solar-Dachfokus neu synchronisiert:** Die Gebäudeübersicht bleibt bei ca. **1:500 / 80 m**. Der Solarblock bleibt unabhängig davon bei ca. **1:250 / 40 m**, verwendet nun aber bewusst dieselbe bereits bestätigte **WGS84-Gebäudegeometrie** wie die Gebäudeübersicht. Orthofoto, Solar-WMS und Gebäudekontur erhalten exakt dieselbe WGS84-Bounding-Box und dieselbe Pixelgröße (820 × 520). Damit wird die zusätzliche Projektionskette aus Test 13 vermieden.
2. **Große Gebäude:** Wenn 40 m nicht reichen, wächst nur der Solar-Ausschnitt automatisch, damit das bestätigte Gebäude vollständig sichtbar bleibt. Die 1:500-Gebäudeübersicht bleibt davon unberührt.
3. **Radon-Infoblatt ergänzt:** Neben der Radonschutzverordnung gibt es nun den zweiten Link **„Infoblatt Radon in Gebäuden“** auf die aktuelle Energie-Tirol-Adresse: `https://www.energieagentur.tirol/uploads/tx_bh/608/infoblatt_radon_web_nov_2020.pdf`.
4. **Radon-Rohdaten:** Die technische Ausgabe dokumentiert zusätzlich die Informationsquelle zum praktischen Umgang mit Radon.

## Einbau

Die vier Dateien direkt nach `tools/standortpass/` kopieren und die Dateien aus Test 13 ersetzen.

## Besonders prüfen

### Solar
- Gebäudeübersicht weiter oben weiterhin **1:500**.
- Solar-Dachfokus **ca. 1:250 / 40 m** bzw. automatische Erweiterung bei großem Gebäude.
- Gebäudekontur muss auf dem Orthofoto deckungsgleich sein.
- Solarbild und Orthofoto müssen denselben Ausschnitt verwenden.
- Der Solarblock ist bewusst unabhängig vom Maßstab der Gebäudeübersicht.

### Radon
- Beide Links öffnen: **Radonschutzverordnung** und **Infoblatt Radon in Gebäuden**.
- `Bürgerstraße 1, 6020 Innsbruck` bleibt **Radonvorsorgegebiet = ja**, **Radonschutzgebiet = nein**.

## Fachlicher Hinweis Solar

Die Dachfokus-Vorschau kombiniert weiterhin Orthofoto, öffentliche Solarstrahlung und bestätigten Gebäudeumriss. Sie ist noch nicht der interne tirisMaps-Layer „Solarpotential pro Jahr – Gebäude“.

## Fachlicher Hinweis Radon

Der Gebietsstatus ist ein amtlicher Standortindikator. Er sagt nicht aus, welche Radonkonzentration tatsächlich in einem konkreten Gebäude vorliegt und ersetzt keine Messung. Das Energie-Tirol-Infoblatt erläutert Radon, Neubau-/Sanierungshinweise und weiterführende Informationen.
