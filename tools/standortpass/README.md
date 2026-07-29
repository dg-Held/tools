# Standortpass – Schnittstellentest 11

Test 11 baut auf Test 10 auf.

Neu:

1. HQ30/HQ100/HQ300 werden nicht mehr nur nach dem Namen des ArcGIS-Dienstes bewertet. Wenn das Feld `SZENARIO` vorhanden ist, wird explizit mit `SZENARIO=30`, `100` bzw. `300` gefiltert. Damit kann ein HQ300-Objekt nicht mehr als HQ100-Treffer erscheinen.
2. Zusätzliche TIRIS-Naturgefahren werden für die Anzeige bereinigt: bereits über HQ abgedeckte Überflutungs-/Restrisikozonen werden nicht doppelt gezeigt; maßstabsabhängige Übersichtslayer werden zugunsten des Detail-Layers zurückgestellt; WLV-Planungsbereiche erscheinen getrennt von tatsächlichen Gefahrenzonen.
3. Solar-Zusatztest: zwei offizielle/öffentliche WMS-Quellen werden nach Solar-/Dach-/Gebäude-Potenzial-Layern durchsucht. Nur ein tatsächlich per Capabilities bestätigter Layer wird als Kartenbild verwendet. Die ältere SOLAR-TIROL-Dachkartierung wird ausdrücklich nur als historische Orientierung behandelt.
4. Neuer Block `Kultur & Schutzstatus`: öffentliche TIRIS-SPORT/KULTUR-Layer (Archäologie, Ensemble, Kunstkataster etc.) werden am Gebäude/Standort geprüft. Zusätzlich wird testweise die BDA-Denkmalliste Tirol 2026 direkt geladen und textuell nach der Adresse durchsucht. Kunstkataster/Ensemble sind keine automatische Bestätigung von Denkmalschutz; auch die BDA-Liste weist selbst darauf hin, nicht rechtsverbindlich zu sein.

## Einbau

Die vier Dateien direkt nach `tools/standortpass/` kopieren und die Dateien aus Test 10 ersetzen.

## Besonders prüfen

- Bürgerstraße 1: HQ100 sollte nach der Szenario-Validierung **nicht** mehr allein wegen eines HQ300-Datensatzes anschlagen.
- HQ300 sollte weiterhin den passenden Treffer liefern.
- WLV `GZW Planungsbereich` sollte separat unter Planungs-/Hinweisbereiche erscheinen und nicht wie eine rote/gelbe Gefahrenzone wirken.
- `Solarpotenzial-Karte prüfen`: bitte Ergebnis + gefundener Layer bzw. eventuelle CORS-/Capabilities-Meldung kopieren.
- `Kultur & Denkmalschutz prüfen`: bitte BDA-Status und gefundene TIRIS-Layer kopieren.
