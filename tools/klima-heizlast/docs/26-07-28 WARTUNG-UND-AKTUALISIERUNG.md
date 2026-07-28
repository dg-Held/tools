
# Klima & Heizlast – Wartung und Aktualisierung

**Toolversion:** 1.0.0  
**Stand:** 27.07.2026

Dieses Dokument ist die kurze operative Ergänzung zu
`METHODIK-UND-DATENBASIS.md`.

---

## 1. Regelmäßige Prüfintervalle

| Bereich | empfohlen |
|---|---|
| BEV Adressregister | April und Oktober bzw. nach neuem Stichtag |
| GeoSphere INCA | jährlich nach vollständigem Kalenderjahr |
| OIB NAT | bei neuer Richtlinien-/Dateiversion |
| OIB TNAT,13 | bei neuer OIB-Datei |
| TIRIS REST-Service | bei jedem größeren Toolupdate |
| Browser / Druck | vor jeder veröffentlichten neuen Toolversion |

---

## 2. BEV aktualisieren

1. Neuen Stichtagsdatensatz herunterladen.
2. `Aktualitaetsstand.txt`, Nutzungs- und Lizenzdateien prüfen.
3. Benötigte Tabellen bereitstellen:
   - ADRESSE
   - GEMEINDE
   - STRASSE
   - ORTSCHAFT
   - ADRESSE_GST
   - GEBAEUDE
4. Tiroler Index neu erzeugen.
5. Validieren:
   - Anzahl Adressen
   - fehlende Koordinaten
   - Anzahl KGNR
   - Mehrfach-KG
   - zufällige reale Adresssuchen
6. `data/datenstand.json` anpassen.
7. Quellenhinweis im Ausdruck prüfen.

Der Datenstand darf erst geändert werden, nachdem der tatsächlich verwendete
Index neu erzeugt wurde.

---

## 3. INCA jährlich erweitern

Aktuell:

```text
2012–2025
```

Nach vollständigem Jahr 2026:

```text
2012–2026
```

Vorgehen:

1. Verfügbarkeit des vollständigen Jahres bei GeoSphere prüfen.
2. Live-Auswertung zunächst an mehreren Standorten testen.
3. `START_YEAR` / `END_YEAR` und Datenstand gemeinsam aktualisieren.
4. Optional vollständige Precompute-Daten neu erzeugen:
   `KLIMADATEN_AKTUALISIEREN.bat`
5. Prüfen:
   - Talstandort
   - Hang-/Hochlagenstandort
   - Osttirol
   - Datenlücken
   - Dauerlinien
6. Ausdruckdatenstand aktualisieren.

---

## 4. OIB prüfen

Offizielle Startseite:

https://www.oib.or.at/richtlinien/oib-richtlinien-2025/oib-richtlinie-6/

Zu prüfen:

- ist die NAT-Datei noch dieselbe?
- trägt sie einen neuen Dokumentstand?
- ist TNAT,13 ersetzt worden?
- stimmen KGNR und Höhenfelder weiterhin mit dem BEV-Tirol-Bestand überein?

Vor Austausch der Daten immer vollständigen KG-Abgleich durchführen:

```text
BEV-KGNR = NAT-KGNR = TNAT13-KGNR
```

Für den derzeitigen Bestand:

```text
350 = 350 = 350
```

---

## 5. TIRIS prüfen

Service:

https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/terrain/MapServer

Zu prüfen:

- Layer 4 `Image_DGM_5m_M28`
- Identify-Operation
- CORS aus der GitHub-Seite
- plausible Höhen an mindestens drei bekannten Standorten
- Lizenz- und Attributionstext

Keine automatische Höhenkorrektur einführen, ohne die fachliche Methodik
bewusst neu zu bewerten.

---

## 6. Regressionstest nach einem Datenupdate

Mindestens:

### Standort
- Innsbruck
- Inntal außerhalb Innsbruck
- Seefeld / Hochlage
- Osttirol

### Klima
- Temperaturhäufigkeit
- h < 0 / −5 / −10
- Stunden < 15 °C
- hVL
- Hitzetage
- Tropennächte
- NAT / TNAT,13
- Datenqualität

### Heizlast
- Verbrauchsmethode
- Warmwasserabzug
- Flächenband
- HWB
- Maximalleistung
- Mindestleistung
- 90-%-Wert

### Ausgabe
- Desktop
- Mobil
- Druck Seite 1
- Druck Seite 2
- Firefox
- Chromium/Chrome

---

## 7. Versionierung

Empfehlung:

```text
1.0.x  Korrekturen ohne Methodikänderung
1.x.0  neue Funktionen / Kennzahlen
2.0.0  wesentliche Änderung der Berechnungsmethodik
```

Jede Methodikänderung muss gleichzeitig in
`METHODIK-UND-DATENBASIS.md` dokumentiert werden.

---

## 8. Precompute-Status

Der vollständige INCA-Precompute ist in Version 1.0 optional.

Er darf jederzeit später ergänzt werden, sofern:

- die Ergebnisse gegen den Live-Abruf validiert werden,
- NAT-abhängige Berechnungen weiterhin am konkreten Standort erfolgen,
- Live-GeoSphere als Rückfallweg erhalten bleibt.

Dadurch ist die Performance-Schicht von der fachlichen Methodik getrennt.
