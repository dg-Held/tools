# Testplan – Energiefluss V4.3 und Wirtschaftlichkeitskern

## 1. Installation

Paketinhalt über den Website-Hauptordner kopieren und gleichnamige Dateien ersetzen. Es ist nichts zu löschen oder zu verschieben.

## 2. Energiefluss

1. Energiefluss V4 öffnen und mit Strg+F5 neu laden.
2. Prüfen, dass die Reihenfolge Basis → Ergebnis → Gebäudehülle lautet.
3. Prüfen, dass keine prominenten Links zu Standortpass, Heizlast oder Klima vorhanden sind.
4. Ohne Baujahr: Zustandsfallback prüfen.
5. Baujahr 1970 eingeben:
   - Außenwand 1,20
   - Fenster 3,00
   - OGD/Dach 0,55
   - Kellerdecke/Boden 1,35
6. Baujahr 2005 eingeben:
   - Außenwand 0,35
   - Fenster 1,70
   - OGD/Dach 0,20
   - Kellerdecke/Boden 0,40
7. Einen U-Wert manuell überschreiben; Baujahrwechsel darf ihn nicht ersetzen.
8. Gebäudezustand manuell auswählen; nicht bestätigte U-Werte müssen dessen Fallback verwenden.
9. Klimawerte direkt berechnen.
10. Druckvorschau prüfen.

## 3. Datendateien

```bash
node tests/validate-building-data.js
```

Erwartet: `passed: true`.

## 4. ÖNORM-Kern

```bash
node tests/validate-oenorm-b8110-4.js
```

Erwartet: JSON mit `passed: true` und bestandenen Prüfwerten aus Anhang A und B.

## 5. Regression

- bestehende manuelle U-Werte bleiben erhalten
- Energieflussbilanz schließt
- Hüllvergleich reagiert auf U-Werte
- V3 bleibt unverändert
- Projekt-Export/-Import funktioniert
