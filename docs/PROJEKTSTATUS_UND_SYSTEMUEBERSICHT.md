# Projektstatus und Systemübersicht – Tools für Energieberatung

**Stand:** 05.08.2026  
**Zweck dieser Datei:** verbindlicher kompakter Übergabestand für neue Chats und weitere Entwicklung.  
**Pflegeregel:** Bei jedem ausgelieferten Änderungs- oder Toolpaket diese Datei prüfen und bei fachlichen, technischen oder strukturellen Änderungen aktualisieren.

## 1. Projektziel

Private, unabhängige, statische Toolsammlung für die Energieberatung in Tirol. Technik: HTML, CSS und JavaScript, Veröffentlichung über GitHub Pages, möglichst ohne Backend.

Die Werkzeuge sollen:

- amtliche und möglichst kostenlose Datenquellen verwenden,
- ohne GIS-Kenntnisse funktionieren,
- während des Kundengesprächs möglichst wenig Eingabe verlangen,
- Projekte und bestätigte Werte toolübergreifend verwenden,
- amtliche, abgeleitete, manuelle und Fallbackwerte unterscheiden,
- keine Scheingenauigkeit darstellen,
- kompakte A4-Ausdrucke erzeugen,
- einzeln nutzbar bleiben und zugleich in einen Gesamtablauf hineinwachsen.

Leitgedanke: Der Berater spricht mit dem Kunden; das Werkzeug stellt bekannte Daten bereit und verlangt nur notwendige Bestätigungen oder Korrekturen.

## 2. Gestaltung und Bedienung

- Schrift: Nunito.
- Primärfarbe: Türkis `#34AB9F`.
- Sekundärfarbe: Berry `#B3446C`.
- ruhige helle Karten, Inhaltsbreite etwa 820 px.
- Gestaltung ausschließlich über gemeinsame Tokens und Komponenten erweitern; neue Farben nicht lokal hart codieren.
- gemeinsamer Projektkopf: Projekttitel/Adresse etwa 2/3, Projekt-ID/Datum etwa 1/3.
- Drucken/PDF oben und am Berichtsende.
- erweiterte Fach- und Finanzannahmen standardmäßig einklappen; notwendige Bestätigungen wie Förderung sichtbar halten.
- Eingaben anfänger- und beratungsfreundlich beschriften; Fachdetails unter Methodik erklären.

Zentrale Gestaltung:

```text
shared/css/tokens.css
shared/css/base.css
shared/css/components.css
shared/css/print.css
```

## 3. Gemeinsames Projektmodell

Speicherung im Browser über `localStorage`; JSON-Export und -Import sind projektweit möglich.

Wertepriorität:

```text
manuell bestätigt → amtlich automatisch → abgeleitet → Fallback
```

Ein manueller Wert verdrängt den automatischen Wert nicht aus dem Projekt. Der automatische Ursprungswert bleibt als Kandidat erhalten und kann durch Zurücksetzen wieder verwendet werden.

Grundregeln:

1. Ein Wert existiert nur einmal im gemeinsamen Projektmodell.
2. Herkunft, Methode, Datenstand und gegebenenfalls Unsicherheit gehören zum Wert.
3. Bestand und Maßnahme werden getrennt gespeichert.
4. Maßnahmen sind toolübergreifend.
5. Rechenergebnisse werden grundsätzlich neu hergeleitet; Berichtssnapshots dienen nur der Nachvollziehbarkeit.
6. Keine Webseite muss vorher geöffnet worden sein: Abhängigkeiten bestehen zwischen Diensten und Rechenkernen, nicht zwischen Oberflächen.

Zentrale Dateien:

```text
shared/js/data-model.js
shared/js/project-migrations.js
shared/js/value-resolver.js
shared/js/project-store.js
shared/js/project-header.js
shared/js/components/
shared/js/services/
shared/js/domain/
```

## 4. Gemeinsame Gebäudegeometrie

Wichtige getrennte Werte:

- Gebäudegrund-/Dachprojektionsfläche,
- ganze oberirdische Geschoßzahl,
- Bruttogeschoßfläche (BGF),
- Nutzfläche (NFL),
- beheizte Nutzfläche,
- Gebäudevolumen,
- Außenwand-, Fenster-, Dach-/OGD- und untere Abschlussflächen.

Aktuelle Ableitungen:

```text
Geschoße ≈ Medianhöhe / 3,2 m, ganzzahlig gerundet
BGF = Dachprojektion × verwendete Geschoße
NFL = BGF × 0,75
Volumen = verwendete BGF / verwendete Geschoße × Medianhöhe
```

Fehlt die Medianhöhe, verwendet die gemeinsame Volumenableitung ersatzweise BGF × Höhenmodul. Manuell bestätigte BGF führt das abgeleitete Volumen nach. Ein manuell bestätigtes Volumen unterbricht diese Kette und bleibt vorrangig. Die beheizte Nutzfläche bleibt bewusst ein eigener Projektwert.

## 5. Aktuelle Werkzeuge

### 5.1 Standortpass Energie & Gebäude

Status: V1, fachlich weitgehend fertig.

Funktion:

- Adresse und TIRIS-Gebäudezuordnung,
- Orthofoto und Geometrie,
- Gelände- und Gebäudehöhen,
- Dachprojektion, Dachneigung und Dachfläche,
- überschlägige Gebäudegrößen einschließlich Geschoße, BGF, NFL und Volumen,
- Wärmeversorgung und Erdwärmehinweise,
- Solar-/Verschattungsinformationen,
- Hochwasser, Naturgefahren, WLV, Radon, Denkmal- und Kulturkontext,
- zwei verdichtete A4-Seiten.

Manuell gewählte Gebäudegeometrien werden inklusive Polygon als Quellen-Snapshot gespeichert.

### 5.2 Klima am Standort

Status: eigenständiges Tool.

- lokale BEV-Adressvorschläge, TIRIS-Livevalidierung, BEV-Fallback,
- OIB NAT/TNAT,13,
- vorberechnete INCA-Jahrespakete ab 2012,
- Jahreslinien, Median, Kennwerte und Datenstand,
- GeoSphere-Liveabruf als Fallback.

Klima ist eine eigenständige Oberfläche; `climate-core` und die Datenbasis werden auch von Heizlast und anderen Tools verwendet.

### 5.3 Heizlast abschätzen

Status: eigenständiges, mit Klima verschränktes Tool.

- verbrauchsbasierte Abschätzung,
- flächenbezogene Orientierung,
- Klimagrundlage automatisch aus dem gemeinsamen Klimadienst,
- editierbare Heizgrenztemperatur mit transparentem Vorschlag,
- vorhandene Heizung und Dauerlinie,
- kompakter Ein-Seiten-Ausdruck.

### 5.4 Energiefluss im Gebäude V4.4

Status: funktional abgeschlossen; V3 ist extern archiviert und online nicht mehr notwendig.

Aufgabe: Diagnose des Ist-Zustands.

- bekannte Projekt- und Verbrauchswerte kompakt prüfen,
- verbrauchsbasierte Bilanz,
- Gebäudehülle und Einzelbauteilverluste,
- Plausibilitätsvergleich aus U-Werten, Flächen und Klima,
- Baujahr als Fallback für nicht bestätigte Bestands-U-Werte,
- bewusste Flächenrundung: Fenster 5 m², übrige Hüllflächen 10 m²,
- Ergebnisse und bestätigte Eingaben zurück in die gemeinsame Basis.

Energiefluss optimiert keine Sanierungsmaßnahme. Von dort führen Bauteilaktionen in „Bauteil & Sanierung“.

### 5.5 Bauteil & Sanierung V0.5

Status: Arbeitsversion, opake Bauteile, Fenster und Haustür vollständig aktiv.

Aufgabe: ein einzelnes Hüllbauteil technisch und wirtschaftlich untersuchen.

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

- eigenständiger Adress- und Geometrieeinstieg,
- Baujahr/Baubewilligung als Bestands-U-Wert-Fallback,
- Pflichtkennzeichnung bei fehlendem U-Wert,
- Dämmdicken in 2-cm-Beratungsschritten bei exakter interner Rechnung,
- diskrete Varianten für Fenster und Türen,
- Kostenoptimum und dynamische Amortisation getrennt,
- Energie, Heizkosten, Betriebs-CO₂ und Oberflächentemperatur,
- Sowiesokosten und drei projektbezogene Förderpositionen,
- Infografik „Sanierung auf einen Blick“,
- eigene SVGs mit Fallback,
- Auswahl als gemeinsame Projektmaßnahme speichern.

Fensterrahmen: Holz, Kunststoff, Holz-Aluminium und Aluminium. Aus dem bereitgestellten informativen Anhang D werden die eindeutig zuordenbaren Fensterwerte verwendet; andere Rahmen und Haustür bleiben transparent gekennzeichnete, überschreibbare Projekt-Fallbacks.

## 6. Gemeinsame Fachkerne

```text
shared/js/domain/economics/economics-core.js
shared/js/domain/measures/envelope-renovation-core.js
```

Der Wirtschaftlichkeitskern bildet die dynamische Betrachtung der ÖNORM B 8110-4:2024 ab und ist gegen das normative Validierungsbeispiel geprüft. Die vollständige Tooloberfläche muss dennoch alle Eingaben, Quellen, Ergebnisse und Sensitivitäten nachvollziehbar dokumentieren, bevor eine Berechnung als vollständig normgemäß bezeichnet wird.

Bauteile der Gebäudehülle und gebäudetechnische Anlagen bleiben fachlich getrennt. Heizungstausch, Rohrleitungsdämmung, Heizflächen, Regelung und Lüftung werden im gemeinsamen Maßnahmenmodell vorgesehen, aber später in eigenen Werkzeugen beziehungsweise im allgemeinen Wirtschaftlichkeitstool behandelt.

## 7. Datenquellen und Datenpflege

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

Pflegeprinzip:

- häufig veränderliche Richtkosten, Energiepreise, Emissionsfaktoren und Empfehlungen in der wartbaren Master-Excel pflegen und später in JSON exportieren,
- normative OIB-Prüfwerte und Nutzungsdauern als getrennte, versionierte Standarddaten führen,
- Förderungen nicht automatisch pflegen; Berater trägt Landes-, Bundes- und sonstige Förderung projektbezogen als Prozentsatz oder Fixbetrag ein,
- Quellen und Datenstand in jeder Datendatei dokumentieren,
- lizenzierte Normtexte niemals in Websitepakete oder öffentliche Repositories kopieren.

## 8. Rundungs- und Aussageprinzip

Intern exakt rechnen, verständlich anzeigen:

- Dämmdicke: 2 cm,
- U-Wert: 0,01 W/m²K,
- Richtpreis: 10 €/m² beziehungsweise passende Stückeinheit,
- Investitionssummen: 500 €,
- jährliche Euro-Wirkung: 50 €/a,
- CO₂: 100 kg/a.

Amtliche oder geometrische Ausgangswerte können intern genauer bleiben. Die sichtbare Beratungsausgabe vermeidet Scheingenauigkeit.

Begriffe:

- **Empfohlener Mindeststandard:** untere Grenze der fachlichen Beratungsempfehlung, kein gesetzlicher Mindestwert.
- **Kostenoptimum:** geringste Gesamtkosten im Betrachtungszeitraum.
- **Amortisationsoptimum:** kürzeste dynamische Amortisationsdauer.
- **Ambitioniert:** langfristig sehr guter Standard über der unteren Empfehlung.

## 9. Druck und Dokumentation

Jedes Werkzeug besitzt:

- einen kompakten Bericht,
- Methodik, Annahmen und Grenzen,
- Datenstand und Quellen,
- Druck/PDF oben und unten.

Webvarianten dürfen ausführlicher sein; nicht jede Variantenliste gehört in den Kundenausdruck. Druckfarben müssen auch in Graustufen verständlich bleiben. Eigene SVGs sind ohne externe Schrift- oder Bildreferenzen abzulegen.

## 10. Offene nächste Schritte

1. Bauteil & Sanierung nach Praxistest von V0.5 finalisieren.
2. Master-Excel vervollständigen und kontrollierten Excel→JSON-Export erstellen.
3. Allgemeines Wirtschaftlichkeitstool für Maßnahmenvergleich und Maßnahmenpakete.
4. Sanierungsfahrplan mit sortierbaren Maßnahmenkacheln, Abhängigkeiten und Kommentaren.
5. Später: Heizung & Verteilung, Speicher/Eigenverbrauch, Sommerkomfort, Schnellrechner/Fachlinks.
6. Weitere Quellen für belastbare Nutzungsdauern opaker Dämmmaßnahmen prüfen; bis dahin Projekt-Fallbacks sichtbar lassen.

## 11. Entwicklungs- und Übergaberegeln

- Bestehende Fachlogik nicht unnötig duplizieren.
- Ein gemeinsamer Wert und eine gemeinsame Maßnahme besitzen nur eine Quelle der Wahrheit.
- Große Klima-, Adress- und Standarddaten nicht in jedem kleinen Austauschpaket mitsenden.
- Pakete enthalten nur neue/geänderte Dateien; Verschieben und Löschen separat dokumentieren.
- Vor Löschung alter Dateien beide abhängigen Tools prüfen.
- Bei HTML/CSS/JS-Änderungen immer Datei, genaue Stelle, Wirkung und Test beschreiben.
- Zu jedem Paket Syntax-, JSON-, Rechen-, Import/Export- und Druckprüfung durchführen.
- `docs/PROJEKTSTATUS_UND_SYSTEMUEBERSICHT.md` bei jedem Paket aktualisieren.
