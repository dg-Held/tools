# Dokumentation – Tools für Energieberatung

**Stand:** 06.08.2026  
**Gültiger Projektstand:** Standortpass V1.1, Klima, Heizlast, Energiefluss V4.4, Bauteil & Sanierung V0.8 und lokale Excel→JSON-Datenpipeline V1.

Diese Hauptdokumentation ersetzt die bisherigen kleinen Änderungs-, Installations-, Test- und Versionsdateien. Für neue Chats zuerst `PROJEKTSTATUS_UND_SYSTEMUEBERSICHT.md` bereitstellen.

## Verbindliche Dokumente

1. `PROJEKTSTATUS_UND_SYSTEMUEBERSICHT.md`  
   Kompakte vollständige Übergabe für einen neuen Chat.
2. `ARCHITEKTUR_UND_DATENMODELL.md`  
   Ordnerstruktur, Projektspeicher, Wertepriorität, automatische und verwendete Geometrieketten.
3. `METHODIK_ALLER_TOOLS.md`  
   Aufgaben, Berechnungen, Rundungen und Grenzen jedes Werkzeugs.
4. `DATENQUELLEN_WARTUNG_UND_AKTUALISIERUNG.md`  
   Datenquellen, INCA-Jahrespakete, Master-Excel, Standards und Pflegeablauf.
5. `TEST_UND_RELEASE.md`  
   Installation, Regressionstest und Freigabecheck.
6. `ROADMAP.md`  
   Nächste Entwicklungsschritte und fachliche Abgrenzung.

## Dokumentationsregel

Bei jedem ausgelieferten Paket sind mindestens diese Dateien zu prüfen:

- `PROJEKTSTATUS_UND_SYSTEMUEBERSICHT.md`
- das thematisch betroffene Methodik-/Wartungsdokument
- `ROADMAP.md`
- `TEST_UND_RELEASE.md`, wenn sich Installation oder Testfälle ändern

Lizenzierte Normtexte werden weder in diesen Dokumenten noch in öffentlichen Websitepaketen vervielfältigt. Zulässig sind eigene Rechenimplementierungen, Quellenangaben und Abschnittsverweise.

## Lokale Datenaufbereitung

Die wartbare Excelquelle bleibt außerhalb des veröffentlichten Website-Ordners. Der verbindliche Ablauf liegt unter `tools/data-build/README.md`.
