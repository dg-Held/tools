# Bauteil & Sanierung – Wartung und Datenpflege

**Stand:** 04.08.2026  
**Toolstand:** V0.2

## 1. Zentrale Dateien

```text
shared/data/measures/envelope-targets.json
shared/data/measures/lambda-values.json
shared/data/measures/co-benefits.json
shared/data/costs/renovation-costs.json
shared/data/costs/lifetimes.json
shared/data/economics/financial-defaults.json
shared/data/economics/energy-prices.json
shared/data/emissions/emission-factors.json
shared/data/funding/funding.json
```

Diese Dateien sind die Website-Datenpakete der wartbaren Excel-Masterdatei.

## 2. Datenstatus V0.2

Befüllt sind:

- Ziel-U-Werte und rechtliche Prüfwerte,
- λ-Auswahl,
- qualitative Komforthinweise,
- bestätigte EAT-Kostenkennwerte für WDVS, OGD, Kellerdecke und Fenster,
- klar als Vorschlag markierte Kosten für hinterlüftete Fassade, Dach, Boden und Außentür,
- Energiepreise und betriebliche Emissionsfaktoren aus der Masterdatei,
- Finanzannahmen und Rundungsregeln.

Noch zu bestätigen sind:

- vorgeschlagene Nutzungsdauern,
- vorgeschlagene Kostenkennwerte der bisher nicht belegten Maßnahmen,
- projektspezifische Förderungen.

## 3. Förderungen

Förderungen werden nicht als automatische Programmdaten gepflegt. Im Projekt stehen drei freie Felder bereit:

- Landesförderung,
- Bundesförderung,
- sonstige Förderung.

Je Feld kann zwischen Fixbetrag, Prozent der Vollkosten und Prozent der energetischen Mehrkosten gewählt werden. Nur bewusst eingegebene Werte werden berücksichtigt.

## 4. Pflegeprinzip

- Quellwerte bleiben in Excel exakt erhalten.
- Website-Richtpreise werden bewusst auf 10 €/m² bereitgestellt.
- Rechenkerne arbeiten intern ohne Ergebnisrundung.
- Summen werden erst für Anzeige und Ausdruck auf 500 € gerundet.
- Jeder aktive Datensatz benötigt Quelle, Datenstand, Region und Aktivstatus.
- Projektvorschläge dürfen erst nach fachlicher Prüfung als bestätigte Richtwerte gekennzeichnet werden.

## 5. Validierung nach Datenupdate

1. JSON-Syntax prüfen.
2. Eindeutige IDs prüfen.
3. Aktive Datensätze besitzen Zahlen und Quellen.
4. Kostenband unten ≤ Mitte ≤ oben.
5. Sowiesokosten ≤ Vollkosten.
6. Empfehlung und ambitionierter Zielwert sind plausibel angeordnet.
7. Außenwand, Dach, OGD, Kellerdecke und Boden mit je einem Testprojekt rechnen.
8. Fördereingaben als Fixbetrag und Prozentwert prüfen.
9. Ausdruck sowie Projekt-Export/-Import prüfen.

## 6. Rechenkerne

```text
shared/js/domain/measures/envelope-renovation-core.js
shared/js/domain/economics/economics-core.js
```

Fachformeln dürfen nicht in der Oberfläche dupliziert werden. Änderungen benötigen Versionsanhebung, Tests und Dokumentation.
