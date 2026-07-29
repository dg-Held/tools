# Standortpass – Schnittstellentest 15

Test 15 baut auf dem bestätigten Stand von Test 14 auf.

Neu:

1. **Solar-Dachfokus vorerst entfernt:** Die nicht deckungsgleiche Überlagerung aus Orthofoto + Solar-Raster wird nicht weiter künstlich angepasst. Stattdessen zeigt der Zusatzblock wieder eine robuste amtliche Solarstrahlungs-Rasterkarte für das Standortumfeld. Wenn vorhanden, wird bevorzugt `Image Jahressumme` verwendet. Das reine Orthofoto mit TIRIS-Gebäudeumriss bleibt unverändert in der Gebäudeübersicht bei ca. 1:500.
2. **TIRIS-Gebäudesolarpotenzial bleibt verlinkt:** Der direkte Link auf „Solarpotenziale je Gebäude“ bleibt erhalten, bis der öffentliche Einzellayer eindeutig identifiziert ist.
3. **Sommerklima & Lokalklima – Erkundung:** Neuer Testblock gegen `Service_Public/klims_map/MapServer`. Relevante Layer zu Wärmebelastung am Tag, Nachtklima, Kaltluft und Planhinweisen werden dynamisch gesucht und am Standort per ArcGIS-Identify geprüft.
4. **Noch keine Aufnahme ins Standortpass-Ergebnis:** Der Klimablock ist bewusst nur ein Erkundungstest. Heiße Tage, Tropennächte, sommerliche Nachttemperaturen und Klimadiagramme bleiben vorerst dem späteren Klimablatt vorbehalten.
5. **Radon:** Der bestätigte zweite Link auf das Energie-Tirol-Infoblatt bleibt erhalten.

## Einbau

Die vier Dateien direkt nach `tools/standortpass/` kopieren und die Dateien aus Test 14 ersetzen.

## Besonders prüfen

### Solar
- Die Zusatzkarte zeigt wieder Solarstrahlung im gesamten Standortumfeld, nicht nur auf dem Dach.
- Das separate Orthofoto in der Gebäudeübersicht bleibt unverändert.
- Idealerweise wird `Image Jahressumme` als Raster gemeldet.
- Der Link „Solarpotenziale je Gebäude in TIRIS öffnen“ bleibt funktionsfähig.

### Sommerklima & Lokalklima
Nach Adressauswahl ganz unten `Klimakarten Inntal prüfen` anklicken.

Bitte insbesondere zurückmelden:
- Anzahl `relevante Layer gefunden`
- Anzahl `Identify-Treffer am Standort`
- die vier Kartenblöcke für Tag / Nacht / Kaltluft / Planhinweise
- sowie bei Bedarf den Rohdatenblock `TIRIS Klimakarten Inntal`.

Ziel ist noch nicht, diese Angaben sofort in den Standortpass aufzunehmen. Wir wollen zuerst beurteilen, ob sie für die schnelle Vorberatung einen eigenständigen Mehrwert gegenüber dem späteren Klimablatt liefern.

## Fachliche Einordnung

Die regionale Klimaanalyse Inntal ist besonders für Wärmebelastung am Tag und in der Nacht sowie für Kaltluftprozesse interessant. Ein einzelner Standortindikator kann als Vorinformation nützlich sein; detaillierte sommerliche Klimakennwerte gehören methodisch eher in ein eigenes Klimablatt.
