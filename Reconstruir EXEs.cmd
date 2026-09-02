@echo off
setlocal
title Reconstruir SolaraCommerce - EXEs

pushd "%~dp0"

echo ============================================
echo  Reconstruir SolaraCommerce - EXEs
echo  Recompila Studio + Electron + Portable
echo ============================================
echo.

REM -- Verificaciones basicas --
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en PATH. Requiere Node 24.x.
  pause
  exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_MAJOR=%%a
for /f "tokens=1 delims=." %%b in ("%NODE_MAJOR%") do set NODE_MAJOR=%%b
set NODE_MAJOR=%NODE_MAJOR:v=%
if not "%NODE_MAJOR%"=="24" (
  echo [ERROR] Se requiere Node.js 24.x. Instalado:
  node -v
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [INFO] Activando pnpm via Corepack...
  corepack prepare pnpm@10.15.1 --activate
  if errorlevel 1 (
    echo [ERROR] No se pudo activar pnpm.
    pause
    exit /b 1
  )
)

echo [1/4] Instalando dependencias (frozen-lockfile)...
call corepack pnpm install --frozen-lockfile
if errorlevel 1 (
  echo [ERROR] Fallo pnpm install.
  pause
  exit /b 1
)

echo.
echo [2/4] Compilando todos los paquetes (build:all)...
call corepack pnpm build:all
if errorlevel 1 (
  echo [ERROR] Fallo en build:all.
  pause
  exit /b 1
)

echo.
echo [3/4] Compilando shell Electron (desktop:build)...
call corepack pnpm desktop:build
if errorlevel 1 (
  echo [ERROR] Fallo en desktop:build.
  pause
  exit /b 1
)

echo.
echo [4/4] Empaquetando portable (desktop:package)...
call corepack pnpm desktop:package
if errorlevel 1 (
  echo [ERROR] Fallo en desktop:package.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  OK - EXEs reconstruidos
echo ============================================
echo  Portable: .release\portable\SolaraCommerce-Portable\
echo  EXE:      .release\portable\SolaraCommerce-Portable\SolaraCommerce.exe
echo  Unpacked: .release\portable\build\win-unpacked\
echo.
echo  Opcional - verificar con:
echo    corepack pnpm portable:smoke
echo    corepack pnpm test:e2e:portable
echo.

popd
pause
endlocal
