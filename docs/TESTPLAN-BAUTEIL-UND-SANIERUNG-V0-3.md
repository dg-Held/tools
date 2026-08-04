# Testplan – Bauteil & Sanierung V0.3

## 1. Adresse und Geometrie
1. Tool ohne vorherigen Energiefluss öffnen.
2. Adresse mit PLZ und Straße suchen.
3. Treffer auswählen.
4. TIRIS-Gebäude automatisch übernehmen oder aus Kandidaten wählen.
5. Prüfen, ob die Fläche des gewählten Bauteils aktualisiert wird.
6. Eine andere Adresse wählen und den zentralen Projektdialog testen.

## 2. HGT
1. Neues Projekt ohne HGT öffnen.
2. Unter „Erweiterte technische Eingaben“ muss 3.500 Kd/a mit Hinweis „Fallback Tirol“ stehen.
3. Wert ändern, Seite neu laden und Speicherung prüfen.

## 3. Ergebnis
1. Energieeinsparung in kWh/a prüfen.
2. Ergänzende Heizkosteneinsparung in €/a prüfen.
3. Kosten- und Amortisationsdiagramm samt Erklärungstext prüfen.
4. Infografik „Sanierung auf einen Blick“ bei mehreren Dämmdicken prüfen.
5. Förderung eintragen und Kostenbrücke kontrollieren.

## 4. Darstellung
1. „Alle Varianten vergleichen“ muss zunächst geschlossen sein.
2. Druckvorschau öffnen.
3. Farben, Diagramme, Infografik und vollständige Variantentabelle prüfen.
4. Auf abgeschnittene Tabellen oder leere Seiten achten.

## 5. Datenquellen
1. Browser-Netzwerk prüfen:
   - `shared/data/standards/oib/envelope-u-values.json`
   - `shared/data/standards/economics/component-lifetimes.json`
   - `shared/data/measures/exchange-variants.json`
2. Tool muss ohne `shared/data/costs/lifetimes.json` weiter funktionieren.
