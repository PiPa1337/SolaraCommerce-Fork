param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot "tray\SolaraCommerceTray.cs"
$icon = Join-Path $projectRoot "apps\studio\public\branding\solara-orbit.ico"
$output = Join-Path $projectRoot "Abrir SolaraCommerce.exe"
$compilers = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$compiler = $compilers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) {
  throw "No se encontró el compilador C# de .NET Framework 4.x incluido en Windows."
}
if (-not (Test-Path -LiteralPath $source)) {
  throw "No se encontró el código fuente de la aplicación de bandeja."
}
if (-not (Test-Path -LiteralPath $icon)) {
  throw "No se encontró el icono de SolaraCommerce."
}

& $compiler `
  /nologo `
  /target:winexe `
  /platform:anycpu `
  /optimize+ `
  /win32icon:"$icon" `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  /reference:System.Web.Extensions.dll `
  /out:"$output" `
  "$source"

if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) {
  throw "No se pudo compilar Abrir SolaraCommerce.exe."
}

Write-Output $output
