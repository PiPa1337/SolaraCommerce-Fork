@echo off
setlocal
set "ROOT=%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js 24 en PATH. 1>&2
  exit /b 1
)
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not "%NODE_MAJOR%"=="24" (
  echo SolaraCommerce requiere Node.js 24.x. Version detectada: 1>&2
  node --version 1>&2
  exit /b 1
)
set "MODE=--jsonl"
if /I "%~1"=="--mcp" (
  set "MODE="
  shift
)
pushd "%ROOT%"
node --experimental-transform-types --experimental-loader "./scripts/ts-workspace-loader.mjs" "./scripts/agent-cli.mjs" %MODE% %*
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
