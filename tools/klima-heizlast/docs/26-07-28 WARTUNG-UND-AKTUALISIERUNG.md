
# Klima & Heizlast – Wartung und Aktualisierung

**Toolversion:** 1.2.0  
**Stand:** 31.07.2026

Dieses Dokument ist die kurze operative Ergänzung zu
`METHODIK-UND-DATENBASIS.md`.

---

## 1. Regelmäßige Prüfintervalle

| Bereich | empfohlen |
|---|---|
| BEV Adressregister | April und Oktober bzw. nach neuem Stichtag – Vorschlagsindex/Fallback |
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

### TIRIS-Liveabgleich der gewählten Adresse

Nach einer BEV-Aktualisierung zusätzlich prüfen:

- Vorschläge erscheinen weiterhin während der Eingabe,
- nach Auswahl wird bevorzugt per ADRCD gegen TIRIS `ogd_basis` aufgelöst,
- TIRIS-Layer 19 / 22 / 13 sind erreichbar,
- abweichende Schreibweisen von Gemeinde/Ort verändern nicht die Zuordnung bei identischem ADRCD,
- bei Netzausfall bleibt der BEV-Fallback klar gekennzeichnet funktionsfähig.

Der BEV-Stichtag bleibt wartungsrelevant, weil er die lokale Vorschlagsliste bestimmt; er ist ab Version 1.2 aber nicht mehr die bevorzugte Quelle der final ausgewählten Adresse.

---

## 3. INCA jährlich erweitern

### Zielbild

Nach der einmaligen Migration wird jedes abgeschlossene Kalenderjahr separat ergänzt. Frühere Jahre werden **nicht neu berechnet**.

Die Runtime-Struktur ist absichtlich jahresweise und kachelweise:

```text
data/climate-precomputed/
  manifest.json
  yearly/
    index.json
    2012.json
    2012/<tile>.json
    ...
    2026.json
    2026/<tile>.json
```

Eine globale Einzeldatei pro Jahr wird vermieden, weil der Browser sonst für einen Standort alle Tiroler Rasterpunkte dieses Jahres laden müsste.

### Ein Jahr aus 12 Monatsdateien erzeugen

1. Vollständiges Kalenderjahr bei GeoSphere bereitstellen; erwartet werden NetCDF-Dateien mit `T2M` und stündlicher Zeitachse. Die Dateinamen selbst sind nicht maßgeblich – das Skript prüft Inhalt und Zeitstempel.
2. Die 12 Monatsdateien in einen Jahresordner legen, zum Beispiel `C:\INCA\2026`.
3. Ausführen:

```text
INCA_JAHR_AUFBEREITEN.bat 2026 "C:\INCA\2026"
```

4. Die BAT legt beim ersten Start lokal eine Python-Umgebung an und installiert `numpy`, `xarray` und `netCDF4`.
5. Das Skript schreibt direkt nach `data/climate-precomputed/yearly/`, aktualisiert Jahresmanifest, Index und globales Manifest.
6. Danach an mehreren Standorten prüfen: Tal, Hang/Hochlage, Osttirol, Datenlücken, Dauerlinie und Sommerkennwerte.

### Einmalige Migration 2012–2025

Die bestehende Runtime bleibt aktiv, bis alle bisherigen Basisjahre als Jahrespakete vorliegen. Für eine identische Tropennacht-Methodik die Jahre möglichst **chronologisch** erzeugen: Das Paket eines Jahres speichert die Abendstunden des 31. Dezember; das Folgejahr kann damit die Nacht zum 1. Jänner vollständig bewerten. Beim ersten Basisjahr ohne Vorjahrespaket darf genau diese eine Nacht unvollständig bleiben – entsprechend dem bisherigen Start des Gesamtzeitraums.

Erst wenn der alte Basiszeitraum vollständig vorhanden ist, setzt das Skript `yearly_packages.enabled` automatisch auf `true`. Danach erweitern lückenlos anschließende Jahre den Zeitraum automatisch. Ein vorzeitig erzeugtes späteres Jahr bleibt gespeichert, aber bis zum Schließen einer Jahreslücke inaktiv.

### Was nicht mehr manuell geändert wird

Nach Aktivierung der Jahrespakete müssen `START_YEAR` und `END_YEAR` nicht mehr jährlich angepasst werden. Webanzeige, Diagrammtexte, Exportname und Auswertungszeitraum werden aus `manifest.json` abgeleitet.

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

Version 1.2 bereitet die Umstellung auf jahresweise INCA-Pakete vor. Bis zur vollständigen Migration des bisherigen Basiszeitraums bleibt der vorhandene Precompute-/Live-Rückfallweg aktiv.

Produktionsregel:

- keine teilweise Jahresserie aktiv schalten,
- Jahrespakete gegen vorhandene Auswertungen plausibilisieren,
- NAT-abhängige Berechnungen weiterhin am konkreten Standort durchführen,
- Live-GeoSphere als Rückfallweg erhalten,
- nach Aktivierung neue Jahre nur anhängen, nicht alle Altjahre neu erzeugen.

Dadurch bleibt die Performance-Schicht von der fachlichen Methodik getrennt und die jährliche Wartung wird auf ein einzelnes neues Kalenderjahr reduziert.
