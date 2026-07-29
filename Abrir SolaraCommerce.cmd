@echo off
setlocal
title Abrir SolaraCommerce

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-solara.ps1"

if errorlevel 1 (
  echo.
  echo No se pudo abrir SolaraCommerce.
  echo Revisa el mensaje anterior y presiona una tecla para cerrar.
  pause >nul
)

endlocal
