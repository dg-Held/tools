# Standortpass – Schnittstellentest 16

Test 16 baut auf dem bestätigten Stand von Test 15 auf.

## Neu

1. **Gezielte Suche nach den drei noch offenen TIRIS-Energiethemen**
   - `Wärmenetz-Gebiete`
   - `Wärmeerzeugungsanlagen`
   - `Solarpotential pro Jahr – Gebäude`

   Statt nur ausgewählte `Service_Public`-Dienste zu prüfen, liest Test 16 manuell den öffentlich erreichbaren ArcGIS-Servicebaum des Landes Tirol aus. Zuerst werden Dienste mit Energie-/Wärme-/Solar-/TMap-Bezug geprüft. Nur wenn damit noch nicht alle drei Themen gefunden werden, folgt ein breiterer Scan der übrigen öffentlich gelisteten Map-/FeatureServices.

2. **Attribut-Fingerabdrücke**

   Zusätzlich zum Layernamen werden die bekannten TIRIS-Felder zur Bestätigung verwendet.

   Wärmenetz-Gebiet:
   - Typ
   - Versorgungsgebiet
   - Stand
   - Erfassungsmaßstab
   - Kontakt

   Solarpotential Gebäude:
   - Dachfläche < 700 kWh
   - 700–900 kWh
   - 900–1100 kWh
   - 1100–1300 kWh
   - 1300–1500 kWh
   - > 1500 kWh
   - Stand
   - Erfassungsmaßstab

3. **Standorttest bei gefundenem Layer**

   Bei einem plausiblen Wärmenetz- oder Gebäude-Solar-Layer wird der gewählte Standort bzw. das bestätigte TIRIS-Gebäudepolygon direkt gegen den Layer abgefragt. Bei Wärmeerzeugungsanlagen wird testweise ein 20-km-Umkreis verwendet, sofern es sich um einen abfragbaren Feature-Layer handelt.

4. **Solarstrahlung im Umfeld stärker eingezoomt**

   Die robuste flächige Solarstrahlungs-Zusatzkarte wird von ca. 250 m auf **ca. 125 m Kartenbreite** eingezoomt. Das Orthofoto der Gebäudeübersicht bleibt unverändert bei ca. 1:500 / 80 m.

5. **Klimakarten Inntal bleiben nur Erkundung**

   Der Testblock bleibt zur Dokumentation vorhanden, wird aber derzeit nicht als Bestandteil des Standortpass V1 vorgesehen.

## Einbau

Die vier Dateien direkt nach `tools/standortpass/` kopieren und die Dateien aus Test 15 ersetzen.

## Besonders prüfen

### A · Drei Energie-Layer

Nach Möglichkeit zuerst eine Adresse wählen und ein Gebäude bestätigen. Danach unter

`6 · Energie · gezielte Layer-Suche`

auf **„Drei Energie-Layer gezielt suchen“** klicken.

Der Test kann einige Sekunden benötigen, weil bei Bedarf der öffentliche ArcGIS-Servicebaum breiter durchsucht wird. Er wird nur manuell gestartet und ist ausdrücklich ein Entwicklungstest.

Bitte zurückmelden:

- wie viele Dienste geprüft wurden,
- ob einer oder mehrere der drei Ziel-Layer mit `Trefferwahrscheinlichkeit hoch/sehr hoch` gefunden wurden,
- bei Wärmenetz-Gebieten den angezeigten Namen des Versorgungsgebiets,
- bei Wärmeerzeugungsanlagen gefundene Felder bzw. nächstes Objekt,
- beim Gebäude-Solarpotential die ausgegebenen Dachflächenklassen,
- sowie bei Bedarf den Rohdatenblock `TIRIS Energie-Layer-Tiefenscan`.

### B · Plausibilitätsbeispiele aus tirisMaps

Bekannte Vergleichswerte aus manuellen TIRIS-Abfragen:

Wärmenetz-Beispiel:
- Typ: Wärmenetz - Versorgungsgebiet
- Versorgungsgebiet: Wärmenetz Hall-Wattens
- Stand: 01.12.2025
- Erfassungsmaßstab: 5.000
- Kontakt: Link

Solar-Beispiel:
- Dachfläche <700 kWh: 126 m²
- 700–900 kWh: 440 m²
- 900–1100 kWh: 142 m²
- 1100–1300 kWh: 158 m²
- 1300–1500 kWh: 456 m²
- >1500 kWh: 0 m²
- Stand: 01.09.2024
- Erfassungsmaßstab: 5.000

Diese Werte sind nur Plausibilitäts-Fingerabdrücke für die Layeridentifikation, keine allgemeine Standortpass-Berechnung.

### C · Solar-Rasterkarte

`Solarstrahlung-Karte prüfen` sollte jetzt einen Ausschnitt von ca. **125 m** zeigen. Sie bleibt bewusst eine flächige Rasterdarstellung über Gelände und Umgebung, bis der echte Gebäude-Layer technisch bestätigt ist.
