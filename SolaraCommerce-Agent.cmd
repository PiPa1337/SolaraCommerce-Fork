@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%SolaraCommerce.exe" (
  echo No se encontro SolaraCommerce.exe en la carpeta portable 1>&2
  exit /b 1
)
set "ELECTRON_RUN_AS_NODE=1"
set "MODE=--jsonl"
if /I "%~1"=="--mcp" (
  set "MODE="
  shift
)
"%ROOT%SolaraCommerce.exe" "%ROOT%resources\app.asar\dist\agent-cli.cjs" %MODE% %*
exit /b %ERRORLEVEL%
