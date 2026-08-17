@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "SITE_ROOT=%%~fI"

if not "%~1"=="" (
  set "EXCEL=%~f1"
) else (
  echo.
  echo BAUTEIL-DATEN PRUEFEN
  echo Ziehe die BAUTEIL_DATEN_MASTER.xlsx auf diese BAT-Datei
  echo oder gib den vollstaendigen Pfad ein.
  echo.
  set /p "EXCEL=Exceldatei: "
)

if not exist "%EXCEL%" (
  echo.
  echo FEHLER: Datei nicht gefunden: %EXCEL%
  pause
  exit /b 2
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%SCRIPT_DIR%bauteil_data_export.py" --input "%EXCEL%" --site-root "%SITE_ROOT%"
) else (
  python "%SCRIPT_DIR%bauteil_data_export.py" --input "%EXCEL%" --site-root "%SITE_ROOT%"
)

set "CODE=%errorlevel%"
echo.
if not "%CODE%"=="0" echo Die Pruefung wurde mit Fehlercode %CODE% beendet.
pause
exit /b %CODE%
