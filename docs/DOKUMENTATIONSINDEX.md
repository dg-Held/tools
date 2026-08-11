# Dokumentationsindex – Tools für Energieberatung

**Stand:** 11.08.2026  
**Projektmodell:** Schema 2.0

Die Projektdokumentation wird bewusst zentral gepflegt. Frühere toolbezogene Änderungs-, Installations- und Methodik-Einzeldateien sind nicht mehr Bestandteil des verbindlichen Websitepakets.

## Verbindliche Dokumente

1. `docs/PROJEKTSTATUS_UND_SYSTEMUEBERSICHT.md`  
   Vollständiger aktueller Gesamtstand und erste Datei für neue Chats.
2. `docs/ARCHITEKTUR_UND_DATENMODELL.md`  
   Ordnerstruktur, gemeinsames Projektmodell, Werteherkunft, Geometrieketten und Zuständigkeiten.
3. `docs/METHODIK_ALLER_TOOLS.md`  
   Aufgaben, Berechnungswege, Rundungen, Datenherkunft und Grenzen aller Werkzeuge.
4. `docs/DATENQUELLEN_WARTUNG_UND_AKTUALISIERUNG.md`  
   Adress-, Klima-, Gebäude-, Kosten- und Standarddaten sowie deren Pflege.
5. `docs/TEST_UND_RELEASE.md`  
   Lokaler Start, Regressionstests, Linkprüfung, Druckprüfung und Freigabecheck; enthält auch die Regeln für den offenen, anonymisierten HWB-U-Diagnosesatz.
6. `docs/ROADMAP.md`  
   Nächste fachliche und technische Entwicklungsschritte.
7. `docs/NORMVALIDIERUNG-OENORM-B-8110-4-2024.md` und `.json`  
   Getrennte Validierung des gemeinsamen Wirtschaftlichkeitskerns.

## Dokumentationsregel

Bei jeder Änderung wird mindestens `PROJEKTSTATUS_UND_SYSTEMUEBERSICHT.md` aktualisiert. Ändern sich Rechenweg, Datenquelle, Wartung oder Testablauf, wird zusätzlich das jeweils betroffene zentrale Dokument angepasst. Neue toolbezogene Einzel-Dokumentationen werden nicht angelegt. Lokale README-Dateien in `assets/`, `shared/data/` oder `tools/` sind nicht erforderlich; notwendige technische Hinweise werden in die passenden zentralen Dokumente übernommen.
