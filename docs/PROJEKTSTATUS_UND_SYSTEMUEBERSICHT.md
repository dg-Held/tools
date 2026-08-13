# Projektstatus und Systemübersicht – Tools für Energieberatung

**Stand:** 13.08.2026  
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
- Primärfarbe: Türkis `#3CA9A7`, mit `#244242` als dunklem Kontrastton.
- Sekundärfarbe: gedecktes Berry/Violett `#93538F`, mit `#41253F` als dunklem Kontrastton.
- Seitenhintergrund: sehr helles kühles Grau `#EDF1F2`; Karten bleiben überwiegend weiß bzw. sehr hell abgestuft.
- Statusfarben sind bewusst gedeckt; Warnung, Gefahr und Information sollen die Markenfarben nicht überstrahlen.
- Schatten sind neutral auf Graphitbasis statt grünstichig.
- ruhige helle Karten, Inhaltsbreite etwa 820 px.
- neue Farben, Abstände und Komponenten nur über gemeinsame Styles ergänzen.
- gemeinsamer Projektkopf: Projekttitel/Adresse etwa 2/3, Projekt-ID/Datum etwa 1/3.
- Drucken/PDF oben und am Berichtsende.
- erweiterte technische und finanzielle Angaben standardmäßig einklappen.
- gemeinsame Adresskarten zeigen vorrangig nur Suchfeld, Datenanbieter, Status und die jeweilige Hauptaktion; technische Korrekturen bleiben eingeklappt.
- vollständige Rechenwege und Datenquellen stehen am Seitenende unter „Methode und Datenbasis“.
- Marken-, Status-, Text- und Flächenfarben werden zentral über `shared/css/tokens.css` verwaltet.
- Im Standortpass-Druck verwenden Wärmeversorgung sowie die normalen Karten unter Standort/Risiken die helle Türkisfläche. Ein tatsächlicher WLV-Flächentreffer wird als besondere planerische Aufmerksamkeit mit lila Rand und helllila Fläche hervorgehoben; offene Prüfungen bleiben in der Warnfarbe.
- projektbezogene Förderungen sichtbar und manuell bestätigbar halten.

Zentrale Gestaltung:

```text
styles.css
shared/css/tokens.css
shared/css/components.css
shared/css/print.css
shared/css/climate-heating.css
```

`styles.css` enthält die allgemeine Seitenbasis und importiert die zentralen Farb-/Designvariablen aus `shared/css/tokens.css`. Eine separate `shared/css/base.css` existiert bewusst nicht.

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

## 4. Gemeinsame Gebäudegeometrie – Stand V1.5

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

### Standortpass Gebäude & Umgebung

Status: V1.0, praxisgeprüfte Basis; Geometriekette V1.5.

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
- zwei verdichtete A4-Seiten mit DKM/Orthofoto-/Gebäudekontrolle, einheitlichem Berichtstitel und abgestimmtem Projektkopf.

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
- Stand-alone-Ablauf: „Standort analysieren“ lädt die Geometrie; „Klimawerte berechnen“ ergänzt nur den unabhängigen Hüllvergleich. Verbrauchsbilanz und sichtbare Ergebnisse reagieren ohne zusätzlichen allgemeinen Berechnen-Knopf auf Eingabeänderungen,
- Bestands-U-Werte und Hüllflächen bleiben prüf- und überschreibbar; das Baujahr dient nur bei tatsächlicher Angabe als Fallback,
- direkte Übergänge zu Standortpass, Klima, Heizlast sowie Bauteil & Sanierung neben Drucken/PDF,
- vollständige Rechenwege, Datenbasis, Annahmen und Grenzen im gemeinsamen Methodenbereich,
- sichtbare Flächenrundung: Fenster 5 m², übrige Hüllflächen 10 m²,
- direkte Übergabe an Bauteil & Sanierung.

### Bauteil & Sanierung V1.0

Status: V1.0 technisch freigegeben; Vereinfachungsschleife, thermische Hülle, automatische Maßnahmenpakete und Abschlussprüfung umgesetzt. Die Praxisvalidierung mit realen Beratungsfällen folgt als fachliche Validierungsrunde.

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
- Stand-alone-Ablauf: Der Analysebutton lädt die Geometrie. Energiegrundlage in der Reihenfolge kalibrierter Energiefluss → vorhandenes INCA-Klima → transparenter HGT-Fallback; INCA kann direkt im Tool nachgeladen werden. Die Bauteilrechnung reagiert anschließend direkt auf Eingaben,
- kompakte Projektbasis aus Baujahr/Baubewilligung und Nutzfläche (NFL),
- Baujahr legt U-Wert-Vorschläge für alle unterstützten Bauteile vor, nicht nur für das gerade geöffnete Bauteil,
- gemeinsame Geometrie liefert die Bauteilflächen; abweichende Werte bleiben überschreibbar,
- gemeinsamer Hüllstatus mit Energiefluss: relevante Bauteile türkis schraffiert, nicht betrachtete Bauteile beerenfarben; der Status kann im geöffneten Bauteil geändert werden,
- automatische Maßnahmenpakete berücksichtigen ausschließlich als thermische Hülle relevante Bauteile; der Status wird in der Maßnahmenkarte mitgespeichert,
- Berry-Pflichtkennzeichnung bei fehlendem Bestands-U-Wert,
- separaten Variantenblock entfernt; Mindeststandard, wirtschaftlicher Bereich und ambitionierte Variante stehen direkt im Ergebnis,
- Dämmdicken in 2-cm-Schritten bei exakter interner Rechnung,
- diskrete Fenster- und Türvarianten,
- Kostenoptimum und dynamische Amortisation getrennt,
- Energie, Heizkosten, Betriebs-CO₂ und Oberflächentemperatur,
- vereinheitlichte Kostenkarten mit i-Hinweisen, eingeklappte Kosten-/Finanzannahmen und drei offen sichtbare Förderpositionen,
- Infografik „Sanierung auf einen Blick“,
- eigene SVGs mit Fallback,
- gemeinsame Projektmaßnahme,
- automatische Auswertung aller ausreichend vorbereiteten und für die thermische Hülle relevanten Bauteile,
- drei gespeicherte Hüllpakete für Mindeststandard, wirtschaftliche Variante und ambitionierte Variante,
- automatische Vorschläge bleiben mit `automatic-proposal / not-reviewed` klar von bestätigten Maßnahmen getrennt,
- Fingerprint markiert Pakete nach Änderungen an Geometrie, U-Werten, Klima, Kosten oder Finanzannahmen als veraltet.

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

## 9. V1.0-Basis abgeschlossen

Die erste große Entwicklungsrunde ist abgeschlossen und mit mehreren realen beziehungsweise Referenzfällen abgeglichen. Für den eingefrorenen Basisstand gelten als erledigt:

1. gemeinsame Adress-, Geometrie-, Klima-, Verbrauchs- und Hüllwerte toolübergreifend vereinheitlicht,
2. Geometriekette V1.5 einschließlich opaker Außenwand-/Fenstersemantik und Migration geprüft,
3. Standortpass, Klima, Heizlast, Energiefluss V4.4 und Bauteil & Sanierung als eigenständig nutzbare Werkzeuge getestet,
4. verbrauchsbasierter HWB und unabhängiger HWB aus U-Werten fachlich getrennt; V1.0-Methode des unabhängigen Vergleichs festgelegt und regressionsgesichert,
5. gemeinsame Druckgestaltung, zentrale Farb-Tokens und zentrale Dokumentation abgeschlossen.

Das nächste Werkzeug beziehungsweise die nächste Erweiterung wird bewusst als neuer Entwicklungsschritt gestartet. Bereits vorgemerkte V1.x-Themen stehen ausschließlich in `ROADMAP.md` und werden nicht rückwirkend in den abgeschlossenen V1.0-Basisstand gezogen.

## 9a. Technischer Bereinigungsstand 07.08.2026

- fehlendes `shared/js/project-address-manager.js` ergänzt, einschließlich sicherer Behandlung von Adresswechseln,
- veralteten Startseitenlink auf Energiefluss V4.4 korrigiert,
- Dokumentationsindex auf die tatsächlich vorhandenen zentralen Dokumente reduziert,
- Versionsangaben der Toolübersicht vervollständigt und Bild `in_arbeit.jpg` eingebunden.

- Favicon zentral unter `assets/svg/favicon.svg` eingebunden; alle Seiten verwenden denselben Pfad,
- Bauteil & Sanierung auf V1.0 gesetzt,
- Methodenbereiche von Klima, Heizlast, Energiefluss und Bauteil um die tatsächlich verwendeten Formeln ergänzt,
- HGT-Fallback im Bauteiltool auch rechnerisch als Stand-alone-Energiegrundlage aktiviert,
- abschließender statischer Release-Check für lokale Ressourcen, gemeinsame UI-Bausteine und Produktionsdatenbestand ergänzt,
- ungenutzte Altdateien `assets/svg/48x48.svg` und `tools/manifest.json` aus dem Zielstand entfernt; das neue Favicon liegt ausschließlich unter `assets/svg/favicon.svg`,
- die kompakte Struktur-ZIP enthält absichtlich nicht alle großen BEV-/INCA-Dateien; für den Produktionsordner ist die Vollständigkeit gegen die jeweiligen Manifeste als eigener Releasepunkt dokumentiert.

## 10. Übergaberegeln

- große Klima-, Adress- und Standarddaten nicht in kleinen Austauschpaketen mitsenden,
- Pakete enthalten nur neue/geänderte Dateien,
- Verschieben und Löschen separat dokumentieren,
- vor dem Löschen alter Dateien abhängige Tools testen,
- bei jedem Paket Syntax-, JSON-, Rechen-, Import/Export- und Druckprüfung durchführen,
- diese Datei bei jedem Paket aktualisieren.

## 11. Finaler V1.0-Abschluss 11.08.2026

Der statische und automatisierte Gesamtcheck ist abgeschlossen. Alle fünf abgeschlossenen V1.0-Basiswerkzeuge können aus einem leeren Projekt heraus gestartet werden; notwendige Standort-, Geometrie-, Klima- oder HGT-Schritte werden im jeweiligen Werkzeug selbst angeboten. Gemeinsame Werte verwenden die kanonischen Projektpfade aus `ARCHITEKTUR_UND_DATENMODELL.md`.

Die sichtbaren Methodenbereiche dokumentieren die tatsächlich implementierten Rechenwege. Für den Wirtschaftlichkeitskern sind Barwert, wiederkehrende Kosten, Ersatzinvestitionen, Entsorgung, Restwert, Gesamtkostenbarwert, Annuität, dynamische Amortisation und analytische Dämmdicke beschrieben. Die Normdokumentation reproduziert keinen lizenzierten Normtext; der Rechenkern wird separat gegen hinterlegte Validierungsfälle geprüft.

Die Praxisabnahme der V1.0-Basis ist abgeschlossen. Die Geometrieableitung, gemeinsamen Projektwerte, Fachkerne und Druckausgaben wurden mit realen beziehungsweise Referenzfällen geprüft. Die Vollständigkeit der großen BEV-/INCA-Pakete bleibt kein Entwicklungsrest, sondern ein wiederkehrender Produktions-Releasecheck gegen die jeweiligen Manifeste.

Bekannte fachliche Grenze des Basisstands: Haustüren besitzen im Energiefluss noch keinen eigenen kalibrierten Verlustanteil und nutzen im Bauteiltool daher Klima/HGT für die Energieeinsparung.

Nicht für V1.0 erforderlich, aber später technisch sinnvoll: lokale Nunito-Schriftdateien auf eine Variable-Font-Lösung reduzieren und die gemeinsame Klima-/Heizlast-Seitenstruktur weiter entflechten, falls die Wartbarkeit wichtiger wird als die derzeitige gemeinsame Implementierung.


## Praxisvalidierung August 2026

Die V1.0-Basis wurde mit mehreren realen beziehungsweise einem theoretischen Beratungsfall sowie einem zusätzlichen Bestands-Energieausweis durchgespielt. Bestätigt wurden insbesondere die Bedeutung einer korrigierten NFL, die Plausibilität der Heizlastorientierung und der Nutzen der gemeinsamen Projektwerte. Der verbrauchsbasierte HWB bleibt unverändert. Für den unabhängigen „HWB aus U-Werten“ wurde nach der Praxisprüfung der frühere Ansatz `15 °C Bilanztemperatur + vollständiger Gewinnabzug` ersetzt: Der festgelegte V1.0-Ansatz skaliert die INCA-Vollbenutzungsstunden auf die gewählte Raumtemperatur und berücksichtigt interne/solare Gewinne mit einem transparenten pauschalen Nutzungsfaktor von 0,55. Der Wert bleibt als Beratungs-Plausibilitätsmodell gekennzeichnet; spätere V1.x-Änderungen benötigen eine erneute dokumentierte Regression gegen Referenzfälle.

## Standortpass · Druckfarben Standort & Risiken · 11.08.2026

- Die graublaue Infofläche der normalen Karten unter `Standort & Risiken` wurde im Ausdruck durch `--color-primary-soft` mit `--color-primary-light` ersetzt und entspricht damit der visuellen Grundlogik der Wärmeversorgung.
- Ein tatsächlicher `WLV-Planungsbereich`-Flächentreffer erhält im Ausdruck eine eigene Semantik: `--color-secondary-soft` als Fläche und `--color-secondary-light` als Rand.
- Warn-/Prüfzustände bleiben unverändert in der Warnfarbe. Die Runtime-Datenlogik und die fachliche Bewertung wurden nicht verändert.

## Letzte Druck- und Vergleichsfeinabstimmung · 11.08.2026

- Hülltabelle: rechte Verlustspalte zeigt nun bewusst den **unabhängigen Transmissionsverlust aus U × A × Standortklima**; die Balkengrafik bleibt verbrauchsbasiert kalibriert. Damit ist ein Bauteil-für-Bauteil-Plausibilitätsvergleich möglich.
- Druckfeinschliff: großzügige Luft nach der Energieflussgrafik und vor der Hülltabelle; Heizlast mit größerem Abstand vor den Beratungskennzahlen und leicht größerer Dauerlinie.
- Energiefluss-Hülltabelle: rechte Spalte und Summenzeile zeigen die unabhängigen Transmissionsverluste aus U × A × Standortklima; die grafische Gebäudehülle bleibt bewusst die verbrauchsbasierte kalibrierte Restgröße.

- Energiefluss-Kennzahl „Verbrauchsabweichung“ eindeutig benannt: sie vergleicht rechnerischen und eingegebenen Heizenergieverbrauch und ist nicht die Differenz der beiden HWB-Kennwerte.


## Dokumentationsabschluss · 11.08.2026

- Die Dateien unter `docs/` sind die einzige verbindliche fachliche und technische Projektdokumentation.
- Frühere lokale README-Dateien in Daten-, Tool- und Assetordnern wurden in die zentralen Dokumente überführt und können entfallen.
- Fachliche Werte, Rechenwege, Datenpflege und Releaseabläufe werden künftig ausschließlich in den passenden zentralen Dokumenten nachgezogen.


## Wirtschaftlichkeit V0.5 · Datenrunde & Vorabnahme · 13.08.2026

- Das Tool bleibt eigenständig nutzbar und verwendet denselben Projekt-/Adresskopf wie die bestehenden Werkzeuge.
- Sichtbare Struktur: **Projektbasis → Rahmen festlegen → Kosten & Förderung → Ergebnis → Methode & Datenbasis**.
- Neue Projekte können über **„Maßnahmen aus Gebäude vorbereiten“** orientierende Hüllmaßnahmen direkt aus gemeinsamer Geometrie, Baujahr/Bestands-U-Werten, Ziel-U-Werten und Energiefluss bzw. HGT-Fallback erzeugen. Das Bauteiltool muss dafür nicht vorher geöffnet werden.
- Dach/OGD, Kellerdecke/Boden und weitere Hüllbauteile folgen dem zentral gespeicherten thermischen Hüllstatus; vorhandene gespeicherte Bauteilmaßnahmen haben Vorrang.
- Heizung und PV erhalten erste zentrale System-Kostenvorschläge aus `shared/data/costs/system-costs.json`. Die PV-Kosten können bereits berücksichtigt werden; das objektspezifische PV-Ertrags-/Eigenverbrauchsmodell ist noch nicht Bestandteil von V0.5.
- Förderungen aus gespeicherten Bauteilmaßnahmen werden übernommen. Ergänzende Landes-/Bundes-/sonstige Förderungen und Paketboni bleiben in V0.5 orientierende Eingaben; eine regelbasierte Förderengine folgt.
- **Förderbasis und Kostenstruktur sind bewusst getrennt:** Förderfähige Kosten sind programmabhängig und können auch Gerüst, Putz oder andere Begleitarbeiten umfassen, die nominal zugleich Referenz-/Instandsetzungsarbeiten darstellen. Förderung wird daher nicht auf die nominalen energetischen Mehrkosten begrenzt; sie wird nur auf die Gesamtinvestition begrenzt.
- Die wirtschaftlich zusätzliche Investition ist `Gesamtinvestition − Förderung − Barwert der erwarteten Referenzerneuerungen` und kann negativ werden; in diesem Fall wird ein **wirtschaftlicher Startvorteil** ausgewiesen.
- Ergebnisdarstellung ergänzt Budgetabgleich, gewählte Kundenprioritäten, Energiekosten vorher/nachher und eine explizit beschriftete Referenzlinie. Optional können die kumulierten Lebenszykluskosten von Referenz und Sanierung als zwei Kurven angezeigt werden.
- Die frühere Bezeichnung „Sensitivität“ wird weiterhin als **Aussagequalität & Unsicherheiten** geführt, bis echte automatische Sensitivitätsläufe implementiert sind.
- Hüllmaßnahmen verwenden ab V0.3 eine **verbrauchsverankerte Gebäudephysik**: Das unabhängige Hüllmodell bestimmt den relativen Effekt `Q_U,nach / Q_U,vor`; dieser Effekt wird auf den realen Raumwärmebedarf übertragen. Dadurch können grobe Bauperioden-U-Werte den realen Verbrauch nicht mehr vollständig „weg-sanieren“.
- Hüllpakete werden als kompletter Gebäudezustand vor/nach Maßnahmen gerechnet; automatisch abgeleitete Einsparungen werden live neu bestimmt. Nur manuelle Overrides bleiben gespeichert.
- Ein Plausibilitätsvergleich `HWB korrigiert aus Verbrauch ↔ HWB aus U-Werten` erzeugt bei deutlicher Abweichung einen Beratungs-Hinweis, ohne die Rechnung zu blockieren.
- Maßnahmen-Details wurden platzsparend auf 2×2 Felder umgestellt; sichtbare kWh-Werte werden überall auf 10 kWh/a gerundet. Referenzzeitpunkte werden als `jetzt / kurzfristig`, `ca. x J.` oder `offen` dargestellt. Ein offener Zeitpunkt wird nicht automatisch als Jahr 0 in die Referenzrechnung übernommen.
- Förderinformationen aus Einzelmaßnahmen stehen direkt bei der Maßnahme; der Kostenblock enthält nur noch die gemeinsame Förderprüfung/-ergänzung. 0-€-Fördersegmente werden nicht mehr gezeichnet.
- Beide Zeitgrafiken besitzen eine beschriftete €-Achse und machen Anfangsdifferenz bzw. Startkosten sichtbar.
- BKI dient weiterhin ausschließlich der internen Plausibilisierung der EAT-Kostenkennwerte; lizenzierte Rohwerte und Regionalfaktoren bleiben außerhalb der öffentlichen Runtime-Daten.
- **Zukunftsfit 2050** ist zweistufig: oben `Bestand heute`, im Ergebnis `mit gewählter Sanierung`. Hülle, Technik, fossilfrei und PV werden fachlich bewertet; reine Datenbekanntheit wird nicht mehr als Zielerreichung dargestellt.
- Der Zielbild-Verlauf wurde gestalterisch von Berry (Bestand) nach Türkis (Zukunft) gedreht.
- Förderdarstellung ergänzt neben `% der Gesamtinvestition` auch `% der nominalen energetischen Investition`; Werte über 100 % sind bei förderfähigen Begleitarbeiten ausdrücklich zulässig.
- Das Referenzsegment der Investitionsgrafik ist neutral/grau.
- Maßnahmen-Accordions bleiben bei Werteänderungen geöffnet. Manuelle Overrides für Vollkosten, Referenzkosten, Referenzzeitpunkt und Energieeinsparung erhalten `↺ automatisch`.
- Zeitdiagramme verwenden die Hauptfarben und versetzen Start-/Zonenbeschriftungen bei Kollisionsgefahr.
- `Mehr als Wirtschaftlichkeit` wird als kompakte Vierer-Wirkungsmatrix über der Einordnung dargestellt; `Aussagequalität & Unsicherheiten` ist standardmäßig geöffnet.
- Die Web-Methodik enthält die implementierten Kernformeln.
- Datenrunde V0.5: zentrale EAT-Richtkosten Hülle/Haustechnik Stand 08/2026 geprüft und vereinheitlicht; alle direkt verwendeten Hüllmaßnahmen besitzen explizite Referenzsemantik. Dachreferenz ist ergänzt; OGD/Kellerdecke sind bewusst `none`, Boden gegen Erdreich `project_specific`. BKI bleibt interne Plausibilisierung; lizenzierte Rohwerte/Regionalfaktoren werden nicht veröffentlicht und EAT-Werte werden nicht doppelt regionalisiert.
- Maßnahmenkarten zeigen Förderhöhen kompakt rechts; der frühere Fördertext im aufgeklappten Teil entfällt. Zahl und Einheit stehen dort platzsparend in einer Zeile.
- Hauptdiagramm reserviert die rechte Kante für den kumulierten Endwert; die Zonenbezeichnung `Sanierung günstiger` liegt mittig und kollidiert nicht mehr mit dem Endlabel.
- Erster konkreter 2-seitiger Beratungsausdruck ist integriert: Seite 1 mit Kundenergebnis, Zukunftsfit Bestand/Sanierung, Kosten-/Finanzierungsbalken und Hauptgrafik; Seite 2 mit Maßnahmentabelle, Lebenszykluskosten, Kundenrahmen, Zusatzwirkungen, Einordnung und Aussagequalität. Finale Druckabnahme folgt nach V0.5-Gesamttest.

