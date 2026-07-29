# Standortpass – Schnittstellentest 12

Test 12 baut auf Test 11 auf und korrigiert drei Punkte aus dem Realtest.

Neu:

1. **Hochwasser-Filter korrigiert:** Die räumliche ArcGIS-Abfrage übernimmt jetzt den übergebenen `where`-Filter wirklich. HQ30/HQ100/HQ300 werden zusätzlich über den codierten Wert `L_KATEGO` validiert (`1 = HQ30`, `2 = HQ100`, `3 = HQ300`). Damit darf ein Datensatz mit `L_KATEGO=3 / SZENARIO=300` nicht mehr als HQ100 erscheinen.
2. **BDA-Adressprüfung exakt:** Straße und Hausnummer müssen jetzt exakt übereinstimmen. `Bürgerstraße 1` darf daher nicht mehr durch `Bürgerstraße 22`, `34` oder `36` als möglicher Denkmalschutz-Treffer markiert werden.
3. **Solar-Dachfokus:** Die allgemeine Solar-Rasterkarte aus Test 11 war nicht die gewünschte tirisMaps-Gebäudepotenzialdarstellung. Test 12 kombiniert daher für die Vorschau das aktuelle TIRIS-Orthofoto mit der öffentlichen Jahressolarstrahlung und begrenzt diese auf das bestätigte TIRIS-Gebäudepolygon. Standardausschnitt ist ca. **1:250 / 40 m**; bei sehr großen Gebäuden wird automatisch erweitert.
4. **Offizielle Gebäude-Potenzialansicht:** Zusätzlich gibt es einen direkten Link zur offiziellen tirisMaps-Ansicht `Solarpotenziale je Gebäude`. Die lokale Dachfokus-Vorschau wird ausdrücklich als abgeleitete Darstellung bezeichnet und nicht mit dem noch nicht eindeutig öffentlich identifizierten tirisMaps-Layer `Solarpotential pro Jahr – Gebäude` gleichgesetzt.

## Einbau

Die vier Dateien direkt nach `tools/standortpass/` kopieren und die Dateien aus Test 11 ersetzen.

## Besonders prüfen

- **Bürgerstraße 1:** HQ30 = kein Treffer; HQ100 sollte nun keinen HQ300-Datensatz mehr übernehmen; HQ300 sollte weiterhin treffen.
- **BDA:** Bürgerstraße 1 sollte keinen Treffer mehr nur wegen Bürgerstraße 22/34/36 erhalten.
- **Solar:** Orthofoto sichtbar? Solarfarben nur im gewählten Gebäudepolygon? Ausschnitt ungefähr 1:250? Gebäude vollständig sichtbar?
- **TIRIS-Solarlink:** Öffnet er direkt die offizielle Ansicht `Solarpotenziale je Gebäude`?

## Fachlicher Hinweis Solar

Die aktuelle öffentliche Dienstübersicht des Landes Tirol nennt den Energiequellen-WMS für Solarstrahlung und Sonnenscheindauer, weist aber den tirisMaps-Gebäudepotenzial-Layer nicht als eigenen öffentlichen WMS/REST-Layer aus. Bis dieser Dienst eindeutig geklärt ist, wird kein Layername geraten.
