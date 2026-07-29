# Standortpass – Schnittstellentest 09

Test 09 lässt Adresse, KG, Gebäude, Orthofoto, DGM und Solar unverändert weiterlaufen. Der Umweltwärmeblock wird fachlich und visuell von einem reinen Trefferzähler zu einer ersten Beratungsansicht weiterentwickelt.

## Umweltwärme – Änderungen

Quelle bleibt der öffentliche TIRIS-Dienst:

`Service_Public/ogd_wasser/MapServer`

### 1. Bestehende Anlagen und Flächenhinweise werden getrennt

Insbesondere wird `Bewilligungspflicht Erdwärmesonde` nicht mehr als vorhandene Erdwärmesonde gezählt.

- `Erdwärmesonde`: bestehende/erfasste Anlagen im 500-m-Umkreis
- `Bewilligungspflicht Erdwärmesonde`: direkter Flächentest am Standort
- `Schutz - und Schongebiet`: direkter Flächentest am Standort
- Grundwasserentnahmen, -rückgaben, -sonden: 500-m-Umkreis
- Grundwasser-Messstellen: 500-m-Umkreis

### 2. Maßstabsabhängige Doppel-Layer werden nicht doppelt gezählt

TIRIS kann dasselbe Thema in mehreren Layern für unterschiedliche Maßstabsbereiche führen, z. B. `Messort Grundwasser` und `Messort Grundwasser (1)`. Test 09 bevorzugt den Detail-Layer und zählt diese Darstellungsvarianten nicht mehr doppelt.

### 3. Nächste relevante Objekte

Bei punktförmigen Treffern werden die drei nächsten Objekte angezeigt, soweit vorhanden mit:

- Entfernung
- Name
- Typ/Subtyp
- Status
- Kataster-Nr.
- Datenstand
- Wasserbuch-Report (`URL_WABU`)
- Wasserinfo-Report (`URL_WAWI`)

Die Reportlinks stammen direkt aus den TIRIS-Attributen und werden nur angezeigt, wenn eine gültige HTTP(S)-URL vorhanden ist.

### 4. Schutz-/Bewilligungsflächen

Bei einem direkten Flächentreffer werden Name/Typ und vorhandene offizielle Detailberichte angezeigt. Damit ist statt `liegt in Gebiet` eine nachvollziehbarere Aussage möglich.

### 5. Standort in tirisMaps öffnen

Test 09 fragt die amtliche Adresskoordinate zusätzlich in EPSG:31254 ab und erzeugt daraus einen tirisMaps-Positionslink (Testmaßstab 1:2500, Orthofoto als Hintergrund).

Wichtig: Der Positionslink übernimmt den Standort/Ausschnitt, aber die Wasser-Themen müssen in tirisMaps weiterhin manuell aktiviert werden. Der Test nennt deshalb direkt die relevanten Themenpfade.

## Installation

Die vier Dateien in `tools/standortpass/` ersetzen:

- `index.html`
- `schnittstellentest.css`
- `schnittstellentest.js`
- `README.md`

`tools/klima-heizlast/` bleibt unverändert.

## Sinnvoller Test

Bürgerstraße 1, 6020 Innsbruck ist besonders geeignet. Erwartet wird gegenüber Test 08 unter anderem:

- bestehende Erdwärmesonden: 0 statt bisher fälschlich 1
- Bewilligungspflicht Tiefensonden: eigener Flächenhinweis
- Grundwasser-Messstellen: keine doppelte Zählung der Maßstabs-Layer
- nächste Grundwasserobjekte mit Namen/Entfernung
- bei Anlagen vorhandene WIS-Detaillinks
- Schutz-/Schongebiet mit Name/Typ
- funktionierender Button `Standort in TIRIS öffnen`
