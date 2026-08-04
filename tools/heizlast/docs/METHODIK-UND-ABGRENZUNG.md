# Heizlast – Methodik und Abgrenzung

**Stand:** 04.08.2026  
**Charakter:** Überschlägige Beratungsorientierung, keine Norm-Heizlast

## 1. Selbstständig, aber mit Klima verschränkt

Das Heizlast-Tool ist eine eigenständige Oberfläche. Es verwendet dieselben jahresweisen INCA-Daten, OIB-NAT und Adressdienste wie das Klima-Tool, ohne dass die Klima-Seite vorher geöffnet werden muss.

## 2. Methoden

### 2.1 Verbrauchsbasierte Heizlast

```text
Nutzwärme gesamt = Jahresverbrauch × Jahresnutzungsgrad
Warmwasser       = Personen × 1.000 kWh/a, wenn enthalten
Raumwärme        = max(Nutzwärme gesamt − Warmwasser, 0)
Heizlast         = Raumwärme / klimatische Vollbenutzungsstunden
```

Der Verbrauch enthält Nutzerverhalten, tatsächliche beheizte Fläche, Raumtemperatur und Anlagenbetrieb. Das Ergebnis ist daher eine wertvolle Betriebsorientierung, aber keine reine Gebäudeeigenschaft.

### 2.2 Flächenbezogener Plausibilitätskorridor

```text
Heizlastbereich = beheizte Nutzfläche × spezifischer Leistungsbereich
```

Aktuelle sichtbare Beratungsbereiche:

| Gebäudeeinschätzung | Bereich |
|---|---:|
| Unsanierter Altbau | 120–160 W/m² |
| Teilsanierter Bestand | 80–120 W/m² |
| Sanierter Bestand | 50–80 W/m² |
| Neuerer Standard / Neubau | 40–70 W/m² |

Diese Bereiche sind Fallbacks und keine Normwerte. Langfristig soll die Gebäudeeinschätzung stärker aus der gemeinsamen Gebäudehülle abgeleitet werden.

### 2.3 HWB-basierte Orientierung

Wenn ein unabhängiger HWB und die dazugehörige BGF vorhanden sind:

```text
jährliche Raumwärme = HWB × BGF
Heizlast            = jährliche Raumwärme / Vollbenutzungsstunden
```

Dieser Wert bleibt von der verbrauchsbezogenen Methode getrennt.

## 3. Heizgrenztemperatur

Die Heizgrenztemperatur ist zwischen 8 und 18 °C überschreibbar. Der bisherige Klimawert bei 15 °C wird mit der medianen Temperaturdauerlinie auf die gewählte Heizgrenze skaliert.

Für einen transparenten Vorschlag wird der spezifische verbrauchsbezogene Raumwärmewert verwendet:

| Raumwärme | Vorschlag |
|---:|---:|
| > 150 kWh/m²a | 16 °C |
| 100–150 kWh/m²a | 15 °C |
| 50–100 kWh/m²a | 14 °C |
| 25–50 kWh/m²a | 13 °C |
| < 25 kWh/m²a | 12 °C |

Das ist eine Beratungsfausttabelle, keine normative eindeutige Ableitung der Bilanztemperatur.

## 4. Klimatische Vollbenutzungsstunden

Zur Standard-Heizgrenze 15 °C:

```text
Σ max(0, (15 °C − T_a,h) / (15 °C − NAT))
```

Bei anderer Heizgrenze wird dieselbe mediane Temperaturdauerlinie verwendet. Die Heizgrenze beeinflusst deshalb konsistent Verbrauchsmethode, Heizstunden, Dauerlinie und Vergleich mit der vorhandenen Anlage.

## 5. Anlagenvergleich

Vorrangige Referenz ist die verbrauchsbasierte Heizlast; fehlt sie, wird die Mitte des Flächenkorridors verwendet.

Verglichen werden unter anderem:

- installierte Maximalleistung,
- optionale Minimalleistung,
- Dimensionierungsfaktor und Reserve,
- Auslastung bei NAT,
- theoretische Volllasttemperatur,
- Leistung zur Abdeckung von 90 % der Heizstunden,
- Stunden über Maximalleistung beziehungsweise unter Minimalleistung.

## 6. Abgrenzung

Das Tool berücksichtigt nicht vollständig:

- raumweise Transmissions- und Lüftungsverluste,
- Aufheizzuschläge,
- genaue Luftwechsel,
- thermische Kopplung zu Nachbarräumen,
- Wärmebrücken nach Norm,
- Auslegung einzelner Heizflächen.

Es ersetzt keine Berechnung nach der jeweils anzuwendenden Norm und keine fachliche Dimensionierung.
