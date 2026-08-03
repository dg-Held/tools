@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM ============================================================
REM  Klima / Heizlast - INCA-Jahr aufbereiten
REM
REM  Verwendung:
REM    INCA_JAHR_AUFBEREITEN.bat 2026 "C:\INCA\2026"
REM
REM  Der Eingabeordner soll die 12 Monats-NetCDF-Dateien des
REM  Zieljahres enthalten. Weitere NetCDF-Dateien sind erlaubt;
REM  ausgewertet werden nur Stunden des angegebenen Jahres.
REM ============================================================

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set "YEAR=%~1"
set "INPUT_DIR=%~2"
set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%..\..\.."
set "CLIMATE_DIR=%ROOT_DIR%\shared\data\climate\inca"
set "VENV=%SCRIPT_DIR%.venv_inca"

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY_LAUNCHER=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo.
    echo FEHLER: Python 3 wurde nicht gefunden.
    echo Bitte Python 3 installieren und danach die BAT-Datei erneut starten.
    pause
    exit /b 1
  )
  set "PY_LAUNCHER=python"
)

if not exist "%VENV%\Scripts\python.exe" (
  echo Erster Start: lokale Python-Umgebung wird angelegt ...
  %PY_LAUNCHER% -m venv "%VENV%"
  if errorlevel 1 goto :error

  echo Benoetigte Pakete werden einmalig installiert ...
  "%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check --upgrade pip
  if errorlevel 1 goto :error
  "%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check numpy xarray netCDF4
  if errorlevel 1 goto :error
)

echo.
echo INCA-Jahr %YEAR% wird aufbereitet.
echo Eingabe: %INPUT_DIR%
echo Ziel:    %CLIMATE_DIR%
echo.

"%VENV%\Scripts\python.exe" "%SCRIPT_DIR%inca_year_precompute.py" --year %YEAR% --input "%INPUT_DIR%" --climate-dir "%CLIMATE_DIR%"
if errorlevel 1 goto :error

echo.
echo Erfolgreich abgeschlossen.
echo Die neuen Jahresdaten liegen unter:
echo   %CLIMATE_DIR%\yearly\%YEAR%
echo.
pause
exit /b 0

:usage
echo.
echo Verwendung:
echo   %~nx0 JAHR "ORDNER_MIT_NETCDF_DATEIEN"
echo.
echo Beispiel:
echo   %~nx0 2026 "C:\INCA\2026"
echo.
pause
exit /b 2

:error
echo.
echo FEHLER: Die Aufbereitung wurde abgebrochen.
echo Die bestehenden Klimadaten wurden nicht geloescht.
echo.
pause
exit /b 1
