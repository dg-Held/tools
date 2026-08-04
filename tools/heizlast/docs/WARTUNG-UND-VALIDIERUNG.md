# Heizlast – Wartung und Validierung

**Stand:** 04.08.2026

## Zuständigkeiten

- `shared/js/domain/heating/heating-core.js`: Heizlastberechnung
- `shared/js/domain/climate/`: gemeinsamer Klimakern
- `shared/js/tools/climate-heating-app.js`: Projektbindung, UI und Druck
- `tools/heizlast/index.html`: Heizlastoberfläche

## Pflichtprüfungen

1. Heizlast direkt ohne vorherigen Besuch des Klima-Tools starten.
2. Adresse wählen und Klimadaten laden.
3. Verbrauch, Nutzungsgrad, Warmwasser und Personen ändern.
4. Heizgrenze manuell ändern; Vollbenutzungsstunden, Dauerlinie und Heizlast müssen reagieren.
5. Auf automatischen Heizgrenzvorschlag zurücksetzen.
6. Flächenkorridor für alle vier Gebäudeeinschätzungen prüfen.
7. HWB + BGF eintragen und unabhängigen Wert prüfen.
8. installierte Minimal-/Maximalleistung vergleichen.
9. Projekt exportieren/importieren und gemeinsame Werte prüfen.
10. einseitigen Druckbericht kontrollieren; Klimagrundlage muss klein am Ende stehen.

## Kontrollformeln

```text
Raumwärme = max(Verbrauch × JNG − Warmwasser, 0)
Heizlast Verbrauch = Raumwärme / Vollbenutzungsstunden
Heizlast Fläche = Fläche × W/m² / 1.000
Heizlast HWB = HWB × BGF / Vollbenutzungsstunden
```

## Grenzfälle

- Warmwasserabzug größer als Nutzwärme: Warnung.
- NAT nicht unter Heizgrenze: Berechnung ablehnen.
- Minimalleistung größer als Maximalleistung: Warnung.
- fehlender Verbrauch: Flächenmethode bleibt als Fallback sichtbar.
- mehrere Katastralgemeinden: eindeutige KG-Auswahl verlangen.

## Änderungsregel

Bei Änderung von Leistungsbereichen, Heizgrenzvorschlag oder Formel gleichzeitig Rechenkern, sichtbare Erläuterung, Methodik, Testfälle und Druck prüfen.
