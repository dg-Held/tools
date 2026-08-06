# Projektstatus und Systemübersicht – Tools für Energieberatung

**Stand:** 06.08.2026  
**Zweck:** Verbindlicher Übergabestand für neue Chats und weitere Entwicklung.  
**Pflegeregel:** Bei jedem Paket aktualisieren.

## 1. Projektziel

Private, unabhängige, statische Toolsammlung für Energieberatung in Tirol. Technik: HTML, CSS und JavaScript auf GitHub Pages, möglichst ohne Backend.

Die Tools sollen:

- amtliche und möglichst kostenlose Datenquellen verwenden,
- ohne GIS-Kenntnisse funktionieren,
- im Beratungsgespräch nur wenige notwendige Eingaben verlangen,
- Projekte und bestätigte Werte toolübergreifend verwenden,
- amtliche, abgeleitete, manuelle und Fallbackwerte unterscheiden,
- keine Scheingenauigkeit darstellen,
- kompakte A4-Ausdrucke erzeugen,
- einzeln nutzbar bleiben und gemeinsam einen Sanierungsfahrplan vorbereiten.

Leitgedanke: Der Berater spricht mit dem Kunden; das Tool stellt bekannte Daten bereit und verlangt nur Bestätigung oder Korrektur.

## 2. Gestaltung und Bedienung

- Schrift: Nunito.
- Primärfarbe: Türkis `#34AB9F`.
- Sekundärfarbe: Berry `#B3446C`.
- ruhige helle Karten, Inhaltsbreite etwa 820 px.
- neue Farben, Abstände und Komponenten nur über gemeinsame Styles ergänzen.
- gemeinsamer Projektkopf: Projekttitel/Adresse etwa 2/3, Projekt-ID/Datum etwa 1/3.
- Drucken/PDF oben und am Berichtsende.
- erweiterte technische und finanzielle Angaben standardmäßig einklappen.
- gemeinsame Adresskarten zeigen vorrangig nur Suchfeld, Datenanbieter, Status und die jeweilige Hauptaktion; technische Korrekturen bleiben eingeklappt.
- vollständige Rechenwege und Datenquellen stehen am Seitenende unter „Methode und Datenbasis“.
- Marken-, Status-, Text- und Flächenfarben werden zentral über `shared/css/tokens.css` verwaltet.
- projektbezogene Förderungen sichtbar und manuell bestätigbar halten.

Zentrale Gestaltung:

```text
shared/css/tokens.css
shared/css/base.css
shared/css/components.css
shared/css/print.css
```

## 3. Gemeinsames Projektmodell

Speicherung über `localStorage`, zusätzlich JSON-Export und -Import.

Wertepriorität:

```text
manuell bestätigt → amtlich automatisch → abgeleitet → Fallback
```

Grundregeln:

1. Ein Wert existiert nur einmal im gemeinsamen Projektmodell.
2. Herkunft, Methode, Datenstand und Unsicherheit gehören zum Wert.
3. Ein manueller Wert löscht den automatischen Ursprungswert nicht.
4. Bestand und Maßnahme bleiben getrennt.
5. Maßnahmen sind toolübergreifend.
6. Ergebnisse werden aus Eingaben neu berechnet; Berichtssnapshots dienen nur der Dokumentation.
7. Ein Tool darf gemeinsame Dienste aufrufen, ohne dass eine andere Toolseite vorher geöffnet wurde.

Zentrale Dateien:

```text
shared/js/data-model.js
shared/js/project-migrations.js
shared/js/value-resolver.js
shared/js/project-store.js
shared/js/project-header.js
shared/js/services/
shared/js/domain/
```

## 4. Gemeinsame Gebäudegeometrie – Stand V1.2

Getrennte Werte:

- TIRIS-Dachprojektion/Gebäudegrundfläche,
- ganze oberirdische Geschoßzahl,
- Bruttogeschoßfläche (BGF),
- Nutzfläche (NFL),
- beheizte Nutzfläche,
- äußeres geometrisches Bruttovolumen,
- konditioniertes/beheiztes Volumen,
- Hüllflächen.

### Automatische Referenzkette

Sie bleibt ohne manuelle Korrekturen nachvollziehbar:

```text
Geschoße_auto = Medianhöhe / Höhenmodul, auf ganze Zahl gerundet
BGF_auto = Dachprojektion × Geschoße_auto
NFL_auto = BGF_auto × Nutzflächenfaktor
beheizte NFL_auto = NFL_auto
Bruttovolumen_auto = Dachprojektion × Medianhöhe
```

Standards:

- Höhenmodul: 3,2 m/Geschoß.
- Nutzflächenfaktor: 75 %.
- Geschoße ausschließlich ganzzahlig.

### Verwendete Kette

```text
Geschoße_verwendet = manuell oder automatisch
BGF_verwendet = manuell oder Dachprojektion × Geschoße_verwendet
NFL_verwendet = manuell oder BGF_verwendet × Nutzflächenfaktor
beheizte NFL_verwendet = manuell oder NFL_verwendet
```

Die beheizte Nutzfläche darf nie größer als die Nutzfläche sein. Eine zu große manuelle Eingabe wird auf die Nutzfläche begrenzt und mit einem Hinweis versehen.

Die reine TIRIS-Referenz bleibt unverändert:

```text
Bruttovolumen_ref = Dachprojektion × Medianhöhe
```

In der verwendeten Geometriekette folgt das Volumen einer korrigierten BGF/NFL:

```text
Grundfläche_verwendet = BGF / Geschoße
Bruttovolumen = Grundfläche_verwendet × Medianhöhe
beheiztes Volumen = Bruttovolumen × beheizter Anteil
```

Ein manuelles Bruttovolumen behält Vorrang. Referenz- und verwendeter Wert bleiben getrennt nachvollziehbar; das beheizte Volumen ist kein normativ bestimmtes Luftvolumen.

## 5. Aktuelle Werkzeuge

### Standortpass Energie & Gebäude

Status: V1.1.1, fachlich weitgehend fertig; Geometriekette V1.4.

- Adresse und TIRIS-Gebäudezuordnung,
- gespeicherter Gebäude-/Polygon-Snapshot,
- Orthofoto, Geländehöhe und Gebäudehöhen,
- Dachprojektion, Umfang, Dachneigung und Dachfläche,
- Geschoße und NFL als priorisierte Prüfeingaben; BGF wird bei bekannter NFL mit dem transparenten Beratungsfaktor 0,75 nachgeführt,
- kompakte Geometriezusammenfassung oberhalb der eingeklappten Detailtabelle: Geschoße, NFL, beheizter Anteil und Plausibilitätsstatus,
- beheizter Anteil als 0–100-%-Regler sowie Fensteranteil als 10–50-%-Regler,
- Geschoßflächen, Fassade und Bruttovolumen folgen der verwendeten Grundfläche; die Dachfläche bleibt am TIRIS-Dachpolygon und reagiert nur auf die Dachneigung,
- automatische TIRIS-Referenzen bleiben parallel erhalten,
- Wärmeversorgung und Umweltwärmehinweise,
- Solar-/Verschattungsinformationen,
- Hochwasser, Naturgefahren, WLV, Radon, Denkmal- und Kulturkontext,
- zwei verdichtete A4-Seiten mit eigenem Berichtstitel und abgestimmtem Abstand zur gemeinsamen Projektkopfzeile.

### Klima am Standort V1.0

Status: eigenständiges Tool.

- BEV-Lokalvorschläge, TIRIS-Livevalidierung, BEV-Fallback,
- OIB NAT/TNAT,13,
- vorberechnete INCA-Jahrespakete ab 2012,
- Jahreslinien, Median, Kennwerte und Datenstand,
- GeoSphere-Liveabruf als Fallback.
- Oberfläche V1.0: verkürzte Einleitung, kompakte gemeinsame Adressauswahl, Quellenkarten und JSON-Export im Methodenbereich sowie direkte Übergänge zu Heizlast und Energiefluss.
- automatischer Beratungsimpuls direkt unter dem Diagramm; Einordnung über klimatische Vollbenutzungsstunden sowie ergänzende Hinweise zu ausgeprägten Kälte- und Sommerbelastungen.
- geplante Erweiterungen: Temperatur-Heatmap nach Ergänzung zeitlicher Aggregate; Windrose erst nach Aufnahme von Windgeschwindigkeit und Windrichtung.

### Heizlast abschätzen V1.0

Status: eigenständiges, mit Klima verschränktes Tool.

- verbrauchsbasierte Abschätzung,
- flächenbezogene Orientierung,
- gemeinsame Klimagrundlage ohne redundante Klimafelder,
- editierbare Heizgrenztemperatur mit transparentem Vorschlag,
- automatischer Gebäudezustandsvorschlag aus korrigiertem Verbrauchs-HWB beziehungsweise Ersatzkennwert; manuelle Auswahl hat Vorrang,
- vorhandene Heizung und Dauerlinie,
- zwei bis drei priorisierte Beratungsaussagen: Leistung für 90 % der Heizstunden, zusätzliche Spitzenleistung und bei vorhandenen Anlagendaten ein gemeinsamer Reserve-/Teillastabgleich,
- technische Standortdaten auf beratungsrelevante Werte reduziert,
- Quellen, Annahmen und JSON-Export unter „Methode und Datenbasis“,
- direkte Übergänge zu Klima und Energiefluss,
- kompakter Ein-Seiten-Ausdruck.

### Energiefluss im Gebäude V4.4

Status: funktional abgeschlossen; Vereinfachungs- und Konsistenzschleife umgesetzt. V3 ist extern archiviert und online nicht mehr erforderlich.

- verkürzte, an Klima und Heizlast angeglichene Einleitung sowie gemeinsame Projektkopf- und Adresslogik,
- Grunddaten mit gemeinsamen Projektbezeichnungen: Nutzfläche (NFL), davon beheizt, Personen, Heizenergieverbrauch, Nutzwärmefaktor (JNG/JAZ) und Warmwasser enthalten,
- Fensterflächenanteil direkt regelbar; Fensterfläche, opake Außenwand und solare Gewinne werden gemeinsam nachgeführt,
- Baujahr/Baubewilligung bleibt eine wichtige optionale Prüfeingabe; 1970 wird nur als Beispiel gezeigt und nicht automatisch gespeichert,
- oberirdische Geschoße, BGF, Gebäudevolumen, Raumtemperatur und Gebäudezustand liegen kompakt im erweiterten Prüfbereich,
- NFL-, BGF-, Geschoß-, Volumen- und Hüllflächenwerte verwenden dieselbe Geometriekette wie der Standortpass; die Dachfläche bleibt am TIRIS-Dachpolygon,
- Gebäudezustand wird mit derselben verbrauchsbasierten HWB-Logik wie im Heizlasttool vorgeschlagen; manuelle Angaben haben Vorrang,
- verbrauchsbasierte Bilanz mit gemeinsamem Heizenergieverbrauch und gemeinsamem Nutzwärmefaktor,
- bei Wärmepumpenfaktoren über 1,0 wird Umweltwärme als eigener Energiezufluss bilanziert,
- ruhiger Ergebnisbereich mit HWB aus Verbrauch, korrigiertem HWB, HWB aus U-Werten und Abweichung,
- rechnerischer Heizenergieverbrauch steht direkt beim unabhängigen Hüllvergleich,
- sichtbarer Klimastatus unterscheidet fehlende, berechnete und aktualisierbare Klimagrundlage,
- Bestands-U-Werte und Hüllflächen bleiben prüf- und überschreibbar; das Baujahr dient nur bei tatsächlicher Angabe als Fallback,
- direkte Übergänge zu Standortpass, Klima, Heizlast sowie Bauteil & Sanierung neben Drucken/PDF,
- vollständige Rechenwege, Datenbasis, Annahmen und Grenzen im gemeinsamen Methodenbereich,
- sichtbare Flächenrundung: Fenster 5 m², übrige Hüllflächen 10 m²,
- direkte Übergabe an Bauteil & Sanierung.

### Bauteil & Sanierung V0.7

Status: Vereinfachungsschleife umgesetzt; praktische V1.0-Prüfung noch offen.

Dämmmaßnahmen:

- Außenwand,
- OGD,
- Dach/Dachschräge,
- Kellerdecke,
- Boden gegen Erdreich.

Austauschmaßnahmen:

- Fenster,
- Haustür/Außentür.

Funktionen:

- an Klima, Heizlast und Energiefluss angeglichener Adress- und Geometrieeinstieg mit bewusstem Analysebutton,
- kompakte Projektbasis aus Baujahr/Baubewilligung und Nutzfläche (NFL),
- Baujahr legt U-Wert-Vorschläge für alle unterstützten Bauteile vor, nicht nur für das gerade geöffnete Bauteil,
- gemeinsame Geometrie liefert die Bauteilflächen; abweichende Werte bleiben überschreibbar,
- Berry-Pflichtkennzeichnung bei fehlendem Bestands-U-Wert,
- separaten Variantenblock entfernt; Mindeststandard, wirtschaftlicher Bereich und ambitionierte Variante stehen direkt im Ergebnis,
- Dämmdicken in 2-cm-Schritten bei exakter interner Rechnung,
- diskrete Fenster- und Türvarianten,
- Kostenoptimum und dynamische Amortisation getrennt,
- Energie, Heizkosten, Betriebs-CO₂ und Oberflächentemperatur,
- vereinheitlichte Kostenkarten mit i-Hinweisen, eingeklappte Kosten-/Finanzannahmen und drei offen sichtbare Förderpositionen,
- Infografik „Sanierung auf einen Blick“,
- eigene SVGs mit Fallback,
- gemeinsame Projektmaßnahme.

Haustür:

- Hauptansicht: Anzahl, Baujahr und U-Wert.
- typische Fläche je Tür nur unter „Erweiterte technische Eingaben“.
- Energiewirkung = Anzahl × Fläche je Tür.
- Kosten = Anzahl × Stückpreis.

## 6. Gemeinsame Fachkerne

```text
shared/js/domain/economics/economics-core.js
shared/js/domain/measures/envelope-renovation-core.js
```

Der Wirtschaftlichkeitskern bildet die dynamische Betrachtung der ÖNORM B 8110-4:2024 ab und wurde gegen das normative Validierungsbeispiel geprüft. Für eine vollständig normgemäße Toolausgabe müssen auch Eingaben, Quellen, Sensitivitäten und Bericht vollständig nachvollziehbar sein.

Gebäudehülle und gebäudetechnische Anlagen bleiben fachlich getrennt. Heizungstausch, Leitungsdämmung, Heizflächen, Regelung und Lüftung werden später in eigenen Werkzeugen beziehungsweise im allgemeinen Wirtschaftlichkeitstool behandelt.

## 7. Datenpflege

Zentrale Datenordner:

```text
shared/data/
├── addresses/
├── building/
├── climate/inca/
├── costs/
├── economics/
├── emissions/
├── measures/
└── standards/
```

- Richtkosten, Energiepreise, Emissionsfaktoren und Empfehlungen werden in einer extern gelagerten Master-Excel gepflegt und mit `tools/data-build/` kontrolliert nach JSON exportiert.
- Die Master-Excel liegt bewusst nicht im veröffentlichten GitHub-Pages-Ordner; GitHub Pages stellt Dateien des Veröffentlichungsbranches öffentlich bereit.
- Das Exportskript benötigt keine zusätzlichen Python-Pakete, prüft Pflichtdaten, sichert bestehende JSON-Dateien neben der Excelquelle und schreibt atomar.
- OIB-Prüfwerte und normative Nutzungsdauern liegen als getrennte versionierte Standarddaten vor.
- Förderungen werden nicht automatisch gepflegt, sondern projektbezogen eingetragen.
- Lizenzierte Normtexte werden nicht veröffentlicht.

## 7a. Excel→JSON-Datenpipeline V1

Status: umgesetzt.

```text
BAUTEIL_DATEN_MASTER.xlsx (privat/extern)
        ↓ prüfen / freigeben
tools/data-build/bauteil_data_export.py
        ↓
shared/data/.../*.json
        ↓
Bauteil & Sanierung / spätere Werkzeuge
```

Hilfsdateien:

```text
tools/data-build/BAUTEIL_DATEN_PRUEFEN.bat
tools/data-build/BAUTEIL_DATEN_AUFBEREITEN.bat
tools/data-build/bauteil_data_export.py
tools/data-build/README.md
```

Sicherheitsregeln:

- nur `Aktiv = ja` wird exportiert,
- leere optionale Bereiche überschreiben bestehende Website-Daten nicht,
- OIB-Prüfwerte, Nutzungsdauern, Austauschvarianten und Förderungen werden nicht aus der Excel erzeugt,
- ein Manifest dokumentiert Quelldatei, Prüfsumme, Version, Datensatzanzahl und Warnungen.

## 8. Rundung

Intern exakt rechnen, bewusst gerundet anzeigen:

- Dämmdicke: 2 cm,
- U-Wert: 0,01 W/m²K,
- Richtpreis: 10 €/m² beziehungsweise passende Stückeinheit,
- Investitionssumme: 500 €,
- jährliche Euro-Wirkung: 50 €/a,
- CO₂: 100 kg/a.

## 9. Nächste Schritte

1. V0.7 praktisch mit typischen Beratungsfällen testen und anschließend Bauteil & Sanierung als V1.0 freigeben.
2. Master-Excel vervollständigen und Excel→JSON-Export umsetzen.
3. allgemeines Wirtschaftlichkeitstool für gespeicherte Maßnahmen.
4. Sanierungsfahrplan mit sortierbaren Maßnahmenkacheln, Abhängigkeiten und Kommentaren.
5. später Heizung & Verteilung, Sommerkomfort sowie Speicher/Eigenverbrauch.

## 9a. Technischer Bereinigungsstand 06.08.2026

- fehlendes `shared/js/project-address-manager.js` ergänzt, einschließlich sicherer Behandlung von Adresswechseln,
- veralteten Startseitenlink auf Energiefluss V4.4 korrigiert,
- Dokumentationsindex auf die tatsächlich vorhandenen zentralen Dokumente reduziert,
- Versionsangaben der Toolübersicht vervollständigt und Bild `in_arbeit.jpg` eingebunden.

## 10. Übergaberegeln

- große Klima-, Adress- und Standarddaten nicht in kleinen Austauschpaketen mitsenden,
- Pakete enthalten nur neue/geänderte Dateien,
- Verschieben und Löschen separat dokumentieren,
- vor dem Löschen alter Dateien abhängige Tools testen,
- bei jedem Paket Syntax-, JSON-, Rechen-, Import/Export- und Druckprüfung durchführen,
- diese Datei bei jedem Paket aktualisieren.
