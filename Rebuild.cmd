@echo off
setlocal
title SolaraCommerce - Rebuild completo
pushd "%~dp0"

echo ============================================
echo  Rebuild: build + package + limpiar + smoke
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no encontrado. Instalalo desde https://nodejs.org
  pause & exit /b 1
)

echo [1/6] Build Studio + paquetes...
call corepack pnpm build
if errorlevel 1 goto :error

echo [2/6] Build Electron...
call corepack pnpm desktop:build
if errorlevel 1 goto :error

echo [3/6] Package portable...
call corepack pnpm desktop:package
if errorlevel 1 goto :error

echo [4/6] Smoke test...
call corepack pnpm portable:smoke
if errorlevel 1 goto :error

echo [5/6] Limpiando win-unpacked...
if exist ".release\portable\build\win-unpacked" rd /s /q ".release\portable\build\win-unpacked"

echo [6/6] Listo!
echo.
for %%f in (".release\portable\SolaraCommerce-Portable\SolaraCommerce.exe") do (
  echo EXE: %%~ff
  echo Fecha: %%~tf
)
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] Fallo en el paso anterior. Revisa el output de arriba.
pause
exit /b 1
