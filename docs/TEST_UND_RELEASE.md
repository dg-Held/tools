# Test und Release

**Stand:** 13.08.2026

## Installation kleiner Austauschpakete

1. Website-Hauptordner sichern.
2. ZIP entpacken.
3. Inhalt des Paketordners über den Website-Hauptordner kopieren.
4. Gleichnamige Dateien ersetzen.
5. Verschieben/Löschen nur nach separater Liste durchführen.
6. Browser mit `Strg + F5` neu laden.

## Pflichtprüfungen

### Gemeinsames Projekt

- Projekttitel/ID bleiben über alle Tools erhalten.
- JSON exportieren, neues Projekt, JSON importieren.
- Adresse korrigieren und neues Projekt starten.
- manuelle Werte bleiben vorrangig; Zurücksetzen stellt Automatik wieder her.

### Geometrie

Mit einem Gebäude mit Dachprojektion und Medianhöhe testen:

1. reine Automatik,
2. Geschoßzahl manuell,
3. BGF manuell,
4. NFL manuell,
5. beheizte NFL größer als NFL,
6. manuelles Bruttovolumen,
7. einzelne Werte zurücksetzen.

Erwartung:

- Automatikreferenz bleibt unverändert sichtbar.
- verwendete Kette folgt nur bis zum nächsten manuellen Wert.
- verwendetes Bruttovolumen folgt `Grundfläche = BGF / Geschoße` und ändert sich bei korrigierter BGF/Geschoßzahl; nur `building.geometry.reference.grossVolume` bleibt als reine TIRIS-Referenz unverändert.
- beheizte NFL ist nie größer als NFL.

### Bauteil & Sanierung

- alle opaken Bauteile rechnen,
- Fenster: Rahmenmaterialien und diskrete Varianten,
- Haustür: Anzahl × Fläche je Tür für Energie, Anzahl × Stückpreis für Kosten,
- fehlender U-Wert blockiert Berechnung und wird Berry markiert,
- eigene SVGs ersetzen Fallback vollständig,
- Förderung und Sowiesokosten,
- Speichern der manuell gewählten Maßnahme,
- thermische Hülle im Energiefluss ändern und prüfen, dass derselbe Status im Bauteiltool erscheint,
- Hüllstatus im Bauteiltool ändern und prüfen, dass Energiefluss denselben `enabled`-Wert übernimmt,
- relevante Bauteile erscheinen türkis schraffiert, nicht betrachtete beerenfarben,
- automatische Maßnahmenpakete erzeugen: Mindeststandard, wirtschaftlich, ambitioniert; nicht relevante Bauteile dürfen in keinem automatischen Paket enthalten sein,
- automatisch erzeugte Einträge tragen `automatic-proposal / not-reviewed` und speichern den Hüllstatus,
- manuell gespeicherte Maßnahmen bleiben beim Aktualisieren der Pakete erhalten,
- Änderung an Fläche, U-Wert oder Finanzannahme markiert vorhandene Pakete als veraltet,
- Bauteile ohne Kostenmodell erhalten technische, aber keine vorgetäuschte wirtschaftliche Variante,
- Bestand, der einen Ziel-U-Wert bereits erfüllt, erzeugt keine Null-Maßnahme im Paket,
- Ausdruck: gemeinsame Projektkopfzeile nur einmal, Berichtstitel ohne große Farbfläche, Adresse nicht doppelt, Hüllstatus beim Bauteil sichtbar, Farben und Infografik korrekt.

### Excel→JSON-Datenpipeline

1. Master-Excel außerhalb des Website-Ordners ablegen.
2. `BAUTEIL_DATEN_PRUEFEN.bat` ausführen; es darf nichts verändert werden.
3. Anzahl aktiver Zielwerte, Baujahreswerte und λ-Werte kontrollieren.
4. Befüllte, aber inaktive Kosten-/Preiszeilen müssen als Warnung erscheinen.
5. `BAUTEIL_DATEN_AUFBEREITEN.bat` ausführen.
6. `shared/data/bauteil-data-manifest.json` prüfen.
7. Vorherige JSON-Dateien müssen unter `BAUTEIL_DATEN_BACKUPS/` neben der Exceldatei gesichert sein.
8. Bauteil & Sanierung öffnen und Kosten, Energiepreis, CO₂-Faktor, Zielwerte und Quellenstatus stichprobenartig vergleichen.
9. Leere optionale Excelbereiche dürfen vorhandene JSON-Dateien nicht überschreiben.
10. Git-Diff beziehungsweise Dateivergleich vor dem Upload prüfen.

### Klima/Heizlast/Energiefluss

- Adresse und Klima laden,
- INCA-Zeitraum/Datenstand,
- Heizlastdruck eine Seite,
- Energieflussdruck als kompakter Einseiter,
- Bauteillinks öffnen richtiges Bauteil.

## Automatisierte Tests

```text
node tests/validate-building-data.js
node tests/validate-project-derived-values.js
node tests/validate-envelope-renovation-core.js
node tests/validate-envelope-auto-package-contract.js
node tests/validate-oenorm-b8110-4.js
node tests/validate-release-integrity.js
```

Zusätzlich JavaScript-Syntax und alle JSON-Dateien prüfen. Für die Datenpipeline außerdem `python tools/data-build/bauteil_data_export.py --help` testen.


## Stand-alone-Prüfung aller Tools

Vor einer Freigabe jedes Tool mindestens einmal aus einem **neuen/leeren Projekt** öffnen:

- **Standortpass:** Adresse → Standort analysieren → Gebäude, Wärmeversorgung, Solar, Standort/Risiken und Methodik ohne vorherigen Toolbesuch nutzbar.
- **Klima:** Adresse → Standort analysieren → Klimakarten, Jahreswerte, Beratungsimpuls, Export und Druck funktionieren eigenständig.
- **Heizlast:** Adresse → Standort analysieren → Klimagrundlage und Heizlast ohne vorherigen Klima-/Energieflussbesuch berechenbar; gemeinsame Eingaben werden anschließend von anderen Tools übernommen.
- **Energiefluss:** Adresse → Standort analysieren für Geometrie; Verbrauchsbilanz reagiert direkt; „Klimawerte berechnen“ ergänzt den unabhängigen Hüllvergleich. Kein zusätzlicher allgemeiner Berechnen-Knopf nötig.
- **Bauteil & Sanierung:** Adresse → Standort analysieren → Baujahr/NFL prüfen → Bauteil rechnen. Energiegrundlage: kalibrierter Energiefluss → vorhandenes INCA-Klima → HGT-Fallback. Automatische Maßnahmenpakete werden bewusst erst über „Vorschläge erstellen“ gespeichert.

Dabei kontrollieren, dass identische Werte nicht als neue toolinterne Speicherfelder entstehen. Insbesondere Baujahr, NFL/BGF, beheizter Anteil, Personen, Heizenergieverbrauch, Nutzwärmefaktor, Warmwasserstatus, Gebäudezustand, Fensterflächenanteil und thermischer Hüllstatus müssen in allen Tools dieselben Projektpfade verwenden.

## Produktionsdaten vor Veröffentlichung

Kleine Struktur-/Austauschpakete dürfen große Adress- und INCA-Dateien bewusst auslassen. Der veröffentlichte Produktionsordner darf diese Lücken jedoch **nicht** enthalten. Vor GitHub-Pages-Upload prüfen:

- alle in `shared/data/addresses/manifest.json` referenzierten Chunk-Dateien sind vorhanden,
- alle in `shared/data/climate/inca/manifest.json` genannten Jahrespakete sind vorhanden,
- `prefix/etc.txt` bzw. `yearly/etc.txt` dienen nur als Marker im kompakten Strukturpaket und gehören nicht als Ersatz für reale Daten in die vollständige Produktion,
- `node tests/validate-release-integrity.js` meldet im vollständigen Produktionsordner keine Datenpaket-Warnung.

## Freigabekriterium

Eine Arbeitsversion wird erst als stabile Version bezeichnet, wenn:

- Pflichtprüfungen bestanden,
- keine Konsolenfehler,
- Import/Export erfolgreich,
- Druck geprüft,
- Dokumentation aktualisiert,
- Datenstände sichtbar,
- bekannte Grenzen dokumentiert sind.

## Ergänzende Regressionen V1.0 / Geometriekette V1.5

Vor Freigabe zusätzlich prüfen:

- Info-Popups öffnen ausschließlich über das `i`-Symbol; das Eingabefeld selbst darf keinen Hoverbereich auslösen oder verdecken.
- Heizlast: BGF-Vorschlag erscheint sofort als `beheizte Nutzfläche / 0,75`, bleibt überschreibbar und kann auf Automatik zurückgesetzt werden.
- Standortpass: Vor „Standort analysieren“ bleiben Ergebnisbereiche ausgeblendet.
- Geschoßzahl und NFL aktualisieren BGF, wirksame Grundfläche, Hüllflächen und Volumen gemäß Geometriekette V1.5; die Dachfläche bleibt an der TIRIS-Dachprojektion und reagiert nur auf die Dachneigung.
- Beheizter Anteil und beheizte Nutzfläche werden bidirektional synchronisiert und auf 0–100 % beziehungsweise höchstens NFL begrenzt.
- Fensteranteil startet bei 20 % und läuft von 10 bis 50 %. Fenster und opake Außenwand sind getrennte gemeinsame Projektwerte; ein bestätigter opaker Außenwandwert darf beim Ändern des Fensteranteils nicht nochmals reduziert werden.
- Automatische Referenzwerte unter `building.geometry.reference.*` bleiben trotz manueller Korrekturen unverändert.
- WMS-/Datenquellen-Details brechen auf schmalen Ansichten um und verursachen keinen horizontalen Seitenüberlauf.

## V1.0-Abschlusscheck 11.08.2026

Automatisiert bestanden:

- JavaScript-Syntax aller vorhandenen JavaScript-Dateien,
- Gebäude-/Datengrundlagen (`validate-building-data.js`),
- gemeinsame Geometrieableitungen (`validate-project-derived-values.js`),
- Bauteil-/Sanierungskern (`validate-envelope-renovation-core.js`),
- Vertrag der automatischen Maßnahmenpakete (`validate-envelope-auto-package-contract.js`),
- normative Regressionsfälle des Wirtschaftlichkeitskerns zur ÖNORM B 8110-4:2024-04-15 (`validate-oenorm-b8110-4.js`),
- Release-Integrität der Runtime-Seiten und aller vorhandenen JSON-Dateien (`validate-release-integrity.js`),
- eindeutige HTML-IDs,
- lokale `href`-/`src`-Verknüpfungen,
- zentrale CSS-Variablen und keine festen CSS-Farben außerhalb `shared/css/tokens.css`.

Das kompakte Übergabepaket enthält absichtlich nur einen kleinen Ausschnitt der großen BEV-Adress- und INCA-Jahresdaten. Deshalb meldet der Release-Test in dieser Struktur Warnungen für fehlende Datenpakete. Im vollständigen Produktionsordner müssen diese Warnungen verschwinden.

Der Quellcode der Druckansichten und die gemeinsame Druck-CSS wurden statisch abgeglichen. Die visuelle Endabnahme wurde mit realen Beratungsfällen durchgeführt; Seitenumbrüche, Diagrammgrößen sowie lange Projekttitel/Adressen bleiben Bestandteil jedes späteren Releasechecks.


## Praxisfälle 08/2026 – HWB-U-Diagnose und Regression

Fünf anonymisierte Praxis-/Referenzfälle dokumentieren den Methodenvergleich des unabhängigen HWB-U-Modells. `tests/diagnose-hwb-u-practice-cases.js` hält sowohl den früheren Ansatz `HGT15 + vollständiger Gewinnabzug` als auch den festgelegten V1.0-Ansatz mit Raumtemperaturbezug und 55 % Gewinnnutzung reproduzierbar fest. Die V1.0-Werte sind Regressionen für die implementierte Beratungslogik, **keine normativen Sollwerte**. Zusätzliche reale Energieausweise können später ergänzt werden; eine bewusste V1.x-Methodenänderung darf die Regressionen nur gemeinsam mit einer dokumentierten fachlichen Begründung aktualisieren. Die übrigen Rechen-, Geometrie-, Hüllstatus-, Wirtschafts- und Release-Tests müssen unverändert bestehen.

Zusätzliche Regressionen des abgeschlossenen V1.0-Stands:
- ältere Außenwandeingabe wird korrekt nach „opak ohne Fenster“ migriert,
- explizit 100 % beheizt bleibt 100 % und erzeugt eine beheizte NFL in Höhe der NFL,
- Druckberichte verwenden denselben Projektkopf, größeren Tooltitel und eine kleine Toolversions-/Methodenzeile,
- fehlende installierte Heizleistung/Mindestleistung erscheint im Heizlast-PDF nicht als 0,0 kW,
- Klima-PDF bleibt einseitig, Energiefluss-PDF wird als kompakter Einseiter aufgebaut,
- DKM-Overlay darf bei Nichterreichbarkeit die übrige Standortanalyse nicht blockieren.


### Bauteilverlustvergleich Energiefluss · 11.08.2026

Zusätzlich prüfen:

- Die Balkengrafik verwendet weiterhin die verbrauchsbasierte kalibrierte Hüllverteilung.
- Die rechte Verlustspalte in Web und Druck verwendet `U × A × HGT_rech / 1.000`.
- Die Summenzeile zeigt `ΣUA`, den verbrauchsbasierten Kalibrierfaktor und als „Hülle aus U-Werten“ exakt die Summe der unabhängigen Tabellenverluste (= `Q_Transmission`).
- Deaktivierte Bauteile ergeben dort 0 kWh/a.
- Ohne Klimagrundlage wird kein unabhängiger Bauteilverlust vorgetäuscht.
- Der verbrauchsbasierte HWB bleibt durch diese Darstellung unverändert.

- Energiefluss: „Verbrauchsabweichung“ muss `HEB_rechnerisch` gegen den eingegebenen Heizenergieverbrauch darstellen; nicht als HWB-Differenz beschriften.

### Farb-/Druckabschluss 11.08.2026

- finale Markenfarben werden ausschließlich über `shared/css/tokens.css` gesteuert: Türkis `#3CA9A7`, Berry/Violett `#93538F`, neutrale Graphit-/Grautöne;
- Seitenhintergrund und Eingabeflächen wurden leicht aufgehellt;
- Schatten verwenden neutrale Graphitwerte und keine alten grünstichigen RGB-Werte;
- Standortpass-Druck: Wärmeversorgung sowie normale Karten unter Standort/Risiken verwenden `--color-primary-soft`; ein tatsächlicher WLV-Flächentreffer verwendet `--color-secondary-soft` mit `--color-secondary-light`; Warn-/Prüfzustände bleiben semantisch getrennt.


### Wirtschaftlichkeit V0.3 · 13.08.2026

Zusätzlich prüfen:

- `tests/validate-economics-core.js` besteht; zeitlich verschobene Kapitalereignisse und Variantenvergleich liefern endliche Werte.
- bestehende Bauteil-Wirtschaftlichkeit bleibt mit dem erweiterten Kern rückwärtskompatibel.
- Wirtschaftlichkeit startet aus leerem Projekt, Adresse/TIRIS können innerhalb des Tools gewählt werden.
- `Maßnahmen aus Gebäude vorbereiten` erzeugt ohne vorherigen Toolwechsel orientierende Hüll-/Systemvorschläge; gespeicherte Bauteilmaßnahmen haben Vorrang.
- thermischer Hüllstatus wird respektiert: gespeichertes/relevantes Dach darf nicht durch eine pauschale OGD-Auswahl verdrängt werden.
- sichtbare Maßnahmen-Energieeinsparungen werden auch in den ausklappbaren Eingabefeldern auf 10 kWh/a gerundet; der automatische Paketvergleich verwendet weiterhin ungerundete Rechenwerte.
- Förderungen aus `Bauteil & Sanierung` werden übernommen; manuelle V0.3-Overrides bleiben als `bis zu` gekennzeichnet.
- Förderung darf die nominalen energetischen Mehrkosten übersteigen, wenn förderfähige Begleitarbeiten enthalten sind; sie wird nur auf die Gesamtinvestition begrenzt.
- wirtschaftlich zusätzliche Investition wird nicht auf 0 begrenzt; negative Werte werden als Startvorteil dargestellt.
- `advice.*` bleibt nach Toolwechsel erhalten; Budget und Prioritäten erscheinen erneut im Ergebnis.
- Energiekosten werden vorher/nachher plus jährliche Einsparung gezeigt.
- Zeitgrafik beschriftet die Referenz-Nulllinie explizit; optionaler Zweilinienchart zeigt kumulierte Lebenszykluskosten von Referenz und Sanierung.
- Förderangaben werden immer als orientierend/`bis zu` gekennzeichnet; Förderbasis und nominale Kostenstruktur werden nicht gleichgesetzt.
- Druckansicht enthält Förderhinweis, Energiekosten vorher/nachher und die wesentlichen Ergebnisgrößen.
- `tests/validate-consumption-anchor-core.js` besteht: Hüllzustand vorher/nachher liefert einen plausiblen relativen Faktor; die auf den realen Verbrauch übertragene Einsparung bleibt positiv und kleiner als der verfügbare reale Wärmebedarf.
- Bei einem absichtlich niedrigen Verbrauch und deutlich höherem U-Wert-HWB bleibt nach der Sanierung ein positiver Restwärmebedarf; die Rechnung wird nicht mehr durch die Summe absoluter U-Wert-Einsparungen auf 0 gedrückt.
- Automatisch abgeleitete Einsparungen werden nach besseren Klima-/Hülldaten neu berechnet; ein manuell gesetzter Einsparungswert bleibt als Override bestehen.
- Referenzzeitpunkt: unbekannt → `offen`, abgelaufene Restlebensdauer → `jetzt / kurzfristig`, sonst `ca. x J.`; übernommene Bauteilmaßnahmen dürfen nicht pauschal auf 0 Jahre gesetzt werden.
- bekannte Referenzkosten mit noch offenem Zeitpunkt bleiben sichtbar, werden aber bis zur Klärung nicht als Kapitalereignis in Jahr 0 gerechnet.
- 0-€-Förderkategorien erzeugen kein sichtbares Segment; Paketbonus verwendet den zentralen `turquoise-soft`-Token.
- Förderangaben der Einzelmaßnahmen werden direkt in den Maßnahmen-Details dargestellt; die gemeinsame Förderprüfung bleibt nur einmal im Kostenblock.
- Haupt- und Vergleichsgrafik zeigen eine beschriftete vertikale €-Achse und die Ausgangsdifferenz.



### Wirtschaftlichkeit V0.4 · 13.08.2026

Zusätzlich zu den V0.3-Fachtests ist vor Freigabe zu prüfen:

- `Zukunftsfit 2050` zeigt **Bestand** und **Sanierungsziel** getrennt; die Auswahl von Hülle/Heizung/PV verändert nur die Zielgrafik.
- ein vollständig schlechter, aber bekannter Hüllzustand wird nicht als positiver Teilfortschritt ausgewiesen.
- Hintergrund des Zielbilds läuft visuell von Berry (Bestand) nach Türkis (Ziel).
- Referenzsegment in der Kostenstruktur ist neutral/grau; Fördersegmente mit 0 € werden weiterhin nicht gezeichnet.
- Förderhinweis zeigt sowohl Anteil an der Gesamtinvestition als auch Anteil an der nominalen energetischen Investition; Werte >100 % sind zulässig und werden durch die getrennte Förderbasis erklärt.
- geöffnete Maßnahmen-Accordions bleiben beim Ändern von Zahlenfeldern geöffnet.
- manuell überschriebene Vollkosten, Referenzkosten, Referenzzeitpunkte und Energieeinsparungen können über `↺ automatisch` auf die aktuelle Ableitung zurückgesetzt werden.
- `Aussagequalität & Unsicherheiten` ist standardmäßig geöffnet.
- Diagrammtexte überlagern sich bei großen Anfangsdifferenzen bzw. nah beieinanderliegenden Startkosten nicht; Referenz- und Sanierungslinie verwenden die Hauptfarben Berry/Türkis.
- `Mehr als Wirtschaftlichkeit` steht als kompakte Wirkungsmatrix über der Einordnung; die Einordnung nutzt anschließend die volle Breite.
- `Methode und Datenbasis` enthält die implementierten Kernformeln für reale Ausgangswärme, verbrauchsverankerte Hüllwirkung, Zielsystem-Endenergie, Barwert und Annuität.

Der Druck ist in V0.4 **noch nicht freigegeben**. Die finale Druckrunde folgt erst nach abgeschlossenem Web-Praxistest und vollständiger Referenzkosten-/Förderdatenrunde.
