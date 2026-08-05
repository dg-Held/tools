# Änderungen – Bauteil & Sanierung V0.4

**Stand:** 05.08.2026

## 1. Klarere Beratungssprache

- „Empfehlung“ wurde durch **„Empfohlener Mindeststandard“** ersetzt.
- Gemeint ist die untere Grenze der fachlichen Beratungsempfehlung, nicht eine gesetzliche Mindestanforderung.
- Der Hinweis zur internen Rechengenauigkeit und gerundeten Darstellung steht nur noch unter Methodik.
- Der erklärende Arbeitsanweisungstext bei Kosten und Wirtschaftlichkeit wurde aus der Hauptoberfläche entfernt.

## 2. Ergebnisdarstellung

- Die doppelten Kennwertkarten der ausgewählten Variante wurden entfernt.
- **„Sanierung auf einen Blick“** ist jetzt die zentrale grafische Ergebniszusammenfassung.
- Ergänzt wurden Gesamtkosten und dynamische Amortisation.
- Energie-, Heizkosten-, CO₂- und Komfortwirkung bleiben gemeinsam sichtbar.
- Eigene SVG-Grafiken können die integrierten Fallback-Symbole ersetzen und werden – sofern geladen – auch im Ausdruck verwendet.

## 3. Förderung

- „Förderungen manuell berücksichtigen“ ist standardmäßig geöffnet.
- Landes-, Bundes- und sonstige Förderung bleiben freie, projektbezogene Eingaben.
- Es werden keine automatisch gepflegten Förderhöhen vorgeschlagen.

## 4. Ausdruck

- Der separate Block „Ausgewählte Variante“ entfällt im Druck.
- „Sanierung auf einen Blick“ enthält U-Werte, Oberflächentemperaturen, Energie, Heizkosten, CO₂, Gesamtkosten und Amortisation.
- Die vollständige Tabelle „Alle Varianten vergleichen“ wird nicht gedruckt.
- Gedruckt werden nur die kompakten Orientierungspunkte: empfohlener Mindeststandard, Kostenoptimum und ambitionierte Variante.

## 5. Fenstervergleich

Fenster sind nun als vollständige diskrete Austauschmaßnahme aktiviert:

- Bestand / keine Maßnahme,
- Basis-Austausch,
- empfohlener Mindeststandard,
- ambitionierte Variante.

Je Variante werden berechnet:

- neuer U-Wert,
- Energie- und Heizkosteneinsparung,
- betriebliche CO₂-Einsparung,
- Richtkosten, Sowiesokosten und Förderung,
- dynamische Gesamtkosten,
- dynamische Amortisation,
- überschlägige innere Oberflächentemperatur und Komfortwirkung.

Fenster können direkt aus Energiefluss V4 über **„Fenster vergleichen“** geöffnet werden.

## 6. Nutzungsdauer und Instandhaltung Fenster

Aus dem informativen Anhang D der ÖNORM EN 15459-1:2017 wurden übernommen:

- Fenster mit Holzrahmen: 30 Jahre Nutzungsdauer, jährliche Instandhaltung 1,0 % der Anfangsinvestition,
- Fenster mit Aluminiumrahmen: 30 Jahre Nutzungsdauer, jährliche Instandhaltung 0,5 % der Anfangsinvestition.

Für die opaken Dämmmaßnahmen enthielt der bereitgestellte Auszug keine direkt zuordenbaren Einträge. Dort bleiben die bisherigen, transparent gekennzeichneten Projekt-Fallbacks überschreibbar.

## 7. Versionen

- Oberfläche Bauteil & Sanierung: V0.4
- EnvelopeRenovationCore: 0.4.0
- Austauschvarianten: `2026-08-05-v0.4`
- Nutzungsdauerdatei: `2026-08-05-v0.4`
