# Änderungen Bauteil & Sanierung V0.3

## Bedienung
- Eigenständige Adresssuche mit BEV-Vorschlägen, TIRIS-Live-Abgleich und gemeinsamer Gebäudegeometrie.
- Standortwechsel verwendet denselben zentralen Projektdialog wie Standortpass, Klima, Heizlast und Energiefluss.
- HGT 22/14 erhält einen sichtbaren Tirol-Fallback von 3.500 Kd/a; manuelle Werte bleiben vorrangig.
- Alle Varianten sind im Web standardmäßig eingeklappt.

## Ergebnis
- Energiekosteneinsparung zusätzlich in Euro pro Jahr.
- Kurze Lesehilfen unter den Diagrammen.
- Eigener Hinweis zum Unterschied zwischen Amortisation und Kostenoptimum.
- Neue Infografik „Sanierung auf einen Blick“ mit Energie, Heizkosten, CO2 und Oberflächentemperatur.
- Farbigere Druckausgabe mit Diagrammen, Kostenbrücke, Infografik und vollständiger Variantentabelle.

## Datenstruktur
- OIB-U-Wert-Prüfdaten liegen separat unter `shared/data/standards/oib/envelope-u-values.json`.
- Beratungsempfehlungen bleiben unter `shared/data/measures/envelope-targets.json`.
- Nutzungsdauern werden nicht mehr aus der Pflege-Excel geladen, sondern zentral unter
  `shared/data/standards/economics/component-lifetimes.json`.
- Fenster- und Türvarianten sind unter `shared/data/measures/exchange-variants.json` vorbereitet, aber noch nicht aktiviert.

## Wichtiger Übergangshinweis Nutzungsdauern
Der bereitgestellte PDF-Auszug aus ÖNORM EN 15459-1, Anhang D, enthielt beim technischen Auslesen
nur leere Seiten beziehungsweise winzige Platzhalterbilder. Die bisherigen Prototypwerte bleiben deshalb
vorübergehend als klar gekennzeichnete, überschreibbare Fallbackwerte aktiv. Sie werden erst nach einem
lesbaren Screenshot oder einer korrekt exportierten PDF als Normwerte freigegeben.
