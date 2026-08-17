# Roadmap

**Stand:** 17.08.2026

## V1.0-Basis abgeschlossen · 11.08.2026

Die erste große Entwicklungsrunde ist abgeschlossen. Praxisfälle, Geometriekette V1.5, opake Außenwand-/Fenstersemantik, beheizter Anteil, DKM, gemeinsame Druckgestaltung, zentrale Farben, unabhängiger HWB-U-Vergleich sowie zentrale Dokumentation sind Bestandteil des eingefrorenen Basisstands.

Neue Arbeiten starten ab hier als **V1.x-Erweiterung oder neues Tool**. Bereits funktionierende V1.0-Logik wird nur geändert, wenn ein konkreter fachlicher oder technischer Grund vorliegt.

## HWB aus U-Werten – V1.0-Methodenstand

Die Praxisprüfung ist in den abgeschlossenen V1.0-Methodenstand eingeflossen. Der verbrauchsbasierte HWB bleibt unverändert. Der unabhängige zweite Prüfweg verwendet:

- U-Werte und gemeinsame Hüllflächen,
- INCA-Vollbenutzungsstunden und gewählte Raumtemperatur,
- unveränderten vereinfachten Lüftungsansatz,
- 7,5 % Wärmebrückenzuschlag,
- interne und solare Gewinne mit einem transparenten pauschalen Gewinnnutzungsfaktor von 0,55.

Der Wert bleibt ausdrücklich ein Beratungs-Plausibilitätsmodell und keine Energieausweis- oder Norm-HWB-Berechnung. Zusätzliche reale Energieausweise können den Regressionssatz später erweitern. Eine methodische Änderung erfolgt erst in einer dokumentierten V1.x-Version und nur bei erkennbarem fachlichem Mehrwert.

## Sanierungsfahrplan · V0.1 Pilotprototyp · 17.08.2026

Der erste Rohbau ist umgesetzt: gemeinsamer Projekt-/Adresseinstieg, minimale Projektbasis, `project.advice`, Kontext `Was steht ohnehin an?`, zentraler Kartenkatalog, Vorschlagsregeln, Etappenverwaltung, reduzierte Sanierungsroute, eingeklappter Gesamtkatalog sowie qualitative Zusatzwirkungen. Das Tool bleibt vorerst **Geplant**, nur per Direktlink erreichbar und `noindex,nofollow`.

### Nächste Fach- und Integrationsschritte

1. **Zukunftsfit 2050 zentralisieren:** bestehende Logik aus Wirtschaftlichkeit in einen gemeinsamen Future-Fit-Core überführen; Sanierungsfahrplan und Wirtschaftlichkeit dürfen keine getrennte Zielbildlogik pflegen.
2. **Erneuerungshorizont zentralisieren:** konkrete Termine, Zustand, letztes Erneuerungsjahr + typische Nutzungsdauer und Gebäudealter-Fallback in einen gemeinsamen Service überführen.
3. **Sequenzielle Energieintegration:** jede Etappe als Maßnahmenpaket auf dem Zustand nach der vorigen Etappe neu rechnen; keine Addition unabhängiger Prozentwerte.
4. **Economics anbinden:** Vollkosten, zeitlich korrekte Referenz-Erneuerungen, Förderung, Restinvestition, wirtschaftlich zusätzliche Investition und Lebenszykluskosten aus dem bestehenden Economics-Core verwenden.
5. **Zeit-/Investitionsgrafik:** Referenz-Erneuerungen neutral grau, energetische Verbesserung Türkis, Förderung Berry; Erklärung, warum eine Maßnahme in einer bestimmten Etappe sinnvoll ist.
6. **Druck V0.x:** Seite 1 als stark reduzierte Kundenseite mit Route/Kernaussage; Seite 2 mit Etappen, Abhängigkeiten, Wirkungen, Unsicherheiten und Datenbasis.
7. **Praxistest:** zuerst Beratungsablauf und Informationsdichte prüfen; erst danach Variantenvergleich mehrerer Gesamtstrategien und Freigabe V1.0.

Nicht vorgesehen ist ein versteckter Optimierungsscore oder die Empfehlung `alles sofort`. Der Fahrplan soll nachvollziehbar zeigen, was jetzt nötig ist, was sinnvoll kombiniert wird, was warten kann, was vorbereitet werden sollte und welche heutige Entscheidung eine spätere Maßnahme nicht verbauen darf.

## Für die nächste V1.x-Version vorgemerkt

### Angrenzende Gebäude

Einfache Möglichkeit für Fassaden, die thermisch nicht gegen Außenluft liegen. Favorit:

```text
davon an Nachbargebäude angrenzend: ___ m²
```

Keine komplexe Randbedingungsmatrix. Später sauber festlegen:

- Wirkung auf Transmissionsverlust,
- Wirkung auf thermisch relevante Außenwandfläche,
- Wirkung auf automatische Fassadensanierungs-/Wirtschaftlichkeitsmaßnahmen.

### Warmwasser / Zirkulation / Verteilung

- Personenpauschale für kleine Gebäude beibehalten.
- Für MFH bzw. zentrale Warmwasserversorgung einen optionalen, transparenten Verteil-/Zirkulationsverlust untersuchen.
- Bevorzugt als separater Zuschlag in kWh/a oder % des Warmwasser-Nutzwärmebedarfs; kein versteckter Standardwert ohne belastbare Quelle.
- Keine vollständige Rohrnetz-/Haustechnikberechnung.

## Nächste Entwicklungsstufe

### Bestehende Tools erweitern

- Klima: Temperatur-Heatmap.
- Klima/Standort: Windrose, sobald geeignete amtliche Windrichtungs-/Windgeschwindigkeitsdaten in die Datenpipeline aufgenommen sind.
- Standortpass: DKM-/Orthofoto-Prüfung weiter verfeinern; später ggf. angrenzende Gebäude einfacher erfassen.

### Wirtschaftlichkeit · V1.0

Das freigegebene Wirtschaftlichkeitstool setzt den vollständigen Beratungsablauf auf derselben Projektbasis um:

- Projektbasis prüfen; NFL als zentrale Geometriegröße hervorgehoben,
- Rahmen, Budget und Kundenprioritäten in wenigen Klicks festlegen,
- Maßnahmen eigenständig aus Gebäude/Baujahr/U-Werten vorbereiten oder aus `Bauteil & Sanierung` übernehmen; automatisch abgeleitete Einsparungen werden live aktualisiert,
- thermischen Hüllstatus (u. a. Dach ↔ OGD) respektieren,
- erste Heizung-/PV-Kostenvorschläge,
- bestehende Bauteilförderungen übernehmen und Paketförderungen ergänzen,
- Kostenstruktur, Förderbasis und Finanzierung fachlich getrennt erklären,
- Verbrauch als reale Größenordnung mit der relativen Hüllwirkung des unabhängigen U-Wert-Modells verschneiden und Abweichungen `Verbrauch ↔ Hüllmodell` sichtbar plausibilisieren,
- Energiekosten vorher/nachher, Budgetabgleich und Kundenprioritäten im Ergebnis zeigen,
- Hauptgrafik mit expliziter Referenzlinie plus optionaler Lebenszykluskosten-Zweilinienansicht und beschrifteten €-Achsen,
- Zukunftsfit-2050-Vergleich `Bestand heute ↔ mit gewählter Sanierung`, stabile Accordions und rücksetzbare manuelle Overrides.

V1.0 ist fachlich und technisch freigegeben: Kosten-/Referenzbasis und Erneuerungshorizonte sind zentralisiert, Zustände `gepflegt / altersgerecht / schadhaft` korrigieren die Automatik transparent, Wartung wird nur bei sinnvollen Defaults angesetzt, und PV bleibt ohne Ertragsadapter bewusst außerhalb der Lebenszykluskurve. Regelbasierte Förderengine, echte automatische Sensitivitätsläufe und PV-Ertrags-/Eigenverbrauchsadapter bleiben klar abgegrenzte Fachausbaustufen.

### Sanierungsfahrplan

Leitgedanke für die Beratung: **„Ein Gebäude verursacht auch unabhängig vom Energieverbrauch langfristig Erhaltungsaufwand.“** Der Fahrplan soll diesen Erhaltungsaufwand sichtbar machen, ohne typische Nutzungsdauern als technisches Ablaufdatum darzustellen.

- Maßnahmenkacheln,
- jetzt / kurzfristig / mittelfristig / später,
- Abhängigkeiten und Reihenfolgehinweise,
- Kommentare,
- kompakter Beratungsbericht,
- Zustandslogik `gepflegt → leichte Instandsetzung`, `altersgerecht → Standardreferenz`, `schadhaft → größere Instandsetzung` als einfacher Beraterinnen-Override für Erneuerungshorizonte,
- Werterhalt qualitativ als `positiv / deutlich positiv`, keine scheinpräzise Marktwertsteigerung,
- Referenz-Erneuerungen, laufender Erhaltungsaufwand und energetische Verbesserungen auf einer gemeinsamen Zeitachse sichtbar machen.

## Grundsatz

Bei jedem neuen Werkzeug gilt:

> Bringt es in einer realen Energieberatung einen eigenen klaren Mehrwert, oder gehört es als Funktion in ein bestehendes Tool?
