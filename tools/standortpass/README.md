# Standortpass – Schnittstellentest 03

Technischer Entwicklungstest für die gemeinsame Standortbasis der Tool-Sammlung.

## Ziel dieser Phase

Test 03 prüft erstmals, ob die lokale BEV-Adressdatei langfristig durch eine TIRIS-Live-Abfrage als Primärquelle ersetzt werden kann.

Geprüft werden:

1. TIRIS Live-Adresssuche über `ogd_basis`
2. Adresscode `ADRCD`, Subcode und Koordinate
3. Katastralgemeinde über TIRIS-Layer 39 am gefundenen Punkt
4. Vergleich desselben Standorts mit dem bestehenden BEV-Modul
5. automatische TIRIS-Gebäudezuordnung
6. Fallback ohne Gebäudegeometrie
7. TIRIS-Orthofoto als visuelle Gebäudekontrolle
8. bestehende TIRIS-DGM-Höhenabfrage aus Klima & Heizlast

## Einbau

Die vier Dateien dieses Ordners kommen direkt nach:

```text
tools/standortpass/
```

Der Ordner muss neben `tools/klima-heizlast/` liegen, weil Test 03 dessen bestehende BEV- und DGM-Module nur als Vergleich/Fallback weiterverwendet.

## Testreihenfolge

### 1. TIRIS live suchen

Format für diesen Entwicklungstest:

```text
Karwendelweg 9, 6123 Terfens
```

oder

```text
Fischergasse 18, <PLZ> <Gemeinde>
```

Der Parser ist noch nicht die spätere Kundensuche. Er dient nur dazu, die eigentliche TIRIS-Query unabhängig vom lokalen BEV-Index zu testen.

Zu prüfen:

- wird die korrekte Adresse gefunden?
- stimmt `ADRCD`?
- stimmt die Koordinate?
- welcher Adress-Layer liefert den Treffer?
- gibt es Mehrfachtreffer?

### 2. Katastralgemeinde

Nach Auswahl einer Live-Adresse wird automatisch Layer 39 `Katastralgemeinden` am Standort abgefragt.

Wichtig ist insbesondere:

- Feldname der KG-Nummer
- Feldname des KG-Namens
- eindeutiger Treffer

Wenn das funktioniert, kann die bisherige KGNR-Zuordnung des lokalen BEV-Index langfristig ebenfalls durch eine Live-Abfrage ersetzt werden.

### 3. TIRIS ↔ BEV

Solange das bestehende BEV-Modul vorhanden ist, vergleicht Test 03 automatisch:

- `ADRCD`
- Koordinate

Das ist nur für die Migration/Validierung gedacht.

### 4. Gebäude

Automatisch wird nur ein **direkter Polygon-Treffer** ausgewählt.

Wenn am Punkt kein Dachpolygon liegt:

- 15-m-Kandidaten werden nur vorgeschlagen,
- danach gegebenenfalls der gewählte größere Umkreis,
- ein einzelnes Nachbargebäude wird nicht automatisch übernommen,
- `Keines davon · ohne Geometrie weiter` ist ausdrücklich möglich.

Damit blockieren Neubauten bzw. Adressen ohne erfasstes Gebäude den Standortpass nicht.

### 5. Orthofoto

Hinter den TIRIS-Polygonen wird testweise der öffentliche WMS-Layer

```text
Image_Aktuell_RGB
```

aus `Service_Public/orthofoto` geladen.

Das dient nur der visuellen Prüfung. Im fertigen Tool soll daraus eine kleine ruhige Gebäudekontrolle werden, kein GIS.

### 6. DGM

Die Höhenabfrage verwendet weiterhin unverändert `LocationCore.fetchElevation()` aus Klima & Heizlast.

## Fachliche Festlegung aus Test 01/02

Für die Außenwand gibt es **keinen pauschalen Korrekturfaktor**.

Orientierungsableitung:

```text
A_AW,brutto ≈ Dachpolygon-Umfang × GEB_HOEHE_MEDIAN
```

- mit ungerundeten Rohwerten rechnen
- Ausgabe auf 10 m² runden
- als Orientierungswert kennzeichnen
- später manuell korrigierbar
- automatischen Rohwert bei manueller Korrektur behalten

## Noch nicht Teil von Test 03

- GeoLand Sonnenbahn / Horizonte
- Fern-/Nahwärme
- Wasser / Umweltwärme
- Hochwasser
- Radon
- Klimaanalyse Inntal

Diese Module folgen erst, wenn die gemeinsame Standortbasis abgeschlossen ist.
