# INCA-Jahrespakete und Live-Fallback

Stand: 03.08.2026

## Rasterzuordnung

INCA verwendet ein 1-km-Raster. Ein beliebiger Standort kann geometrisch bis rund 707 m vom Mittelpunkt der nächstgelegenen Rasterzelle entfernt liegen. Für die technische Rasterpunktzuordnung wird deshalb ein maximaler Suchabstand von 850 m verwendet.

Dieser Abstand ist keine Aussage über die Lagegenauigkeit der Gebäudeadresse. Er bestimmt nur, welchem INCA-Rasterpunkt die Adresse zugeordnet wird.

## Reihenfolge der Datenbeschaffung

1. Jahresindex und nächstgelegenen INCA-Rasterpunkt bestimmen.
2. Jedes aktive Jahr aus seinem statischen Jahrespaket laden.
3. Fehlende oder beschädigte Einzeljahre aus Browsercache oder GeoSphere-Liveschnittstelle ergänzen.
4. Alle Jahresanalysen gemeinsam aggregieren.
5. Ist überhaupt kein vorbereitetes Profil nutzbar, den bewährten Liveabruf des Gesamtzeitraums verwenden.

## Datenquellenanzeige

Bei einer Mischung wird intern `precomputed-yearly+live-years` gespeichert. Zusätzlich werden die lokal geladenen und live ergänzten Jahre getrennt im Ergebnisdatensatz dokumentiert.

## Seltene Einschränkung

Wird ein einzelnes Jahr live nachgeladen, kann die Nacht zum 1. Jänner dieses Jahres mangels sechs Vorabendstunden des Vorjahres als unvollständig gelten. Das betrifft höchstens eine Nacht des seltenen Fehler-Fallbacks; reguläre Jahrespakete verwenden die gespeicherte Vorjahresgrenze.
