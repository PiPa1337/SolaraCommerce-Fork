param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$studioDist = Join-Path $projectRoot "apps\studio\dist"
$studioIndex = Join-Path $studioDist "index.html"
$serverScript = Join-Path $projectRoot "packages\exporter\scripts\serve.mjs"
$runtimeDirectory = Join-Path $projectRoot ".solara-runtime"
$runtimeFile = Join-Path $runtimeDirectory "server.json"

function Test-SolaraServer {
  param([int]$Port)

  try {
    $response = Invoke-WebRequest `
      -Uri "http://127.0.0.1:$Port" `
      -UseBasicParsing `
      -TimeoutSec 1
    return $response.StatusCode -eq 200 -and $response.Content.Contains("<title>SolaraCommerce Studio</title>")
  } catch {
    return $false
  }
}

function Test-SolaraManagedServer {
  param([int]$Port)

  try {
    $response = Invoke-WebRequest `
      -Uri "http://127.0.0.1:$Port/__solara/session" `
      -UseBasicParsing `
      -TimeoutSec 1
    return $response.StatusCode -eq 200 -and $response.Content.Contains('"managed":true')
  } catch {
    return $false
  }
}

function Test-PortAvailable {
  param([int]$Port)

  $listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $Port
  )
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $listener.Stop()
  }
}

try {
  Set-Location -LiteralPath $projectRoot

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 22 o posterior no está instalado o no está disponible en PATH."
  }
  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    throw "Corepack no está disponible. Instalá una versión actual de Node.js."
  }

  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules\.modules.yaml"))) {
    Write-Host "Preparando dependencias por primera vez..." -ForegroundColor Cyan
    & corepack pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
      throw "La instalación de dependencias no pudo completarse."
    }
  }

  $needsBuild = -not (Test-Path -LiteralPath $studioIndex)
  if (-not $needsBuild) {
    $buildTime = (Get-Item -LiteralPath $studioIndex).LastWriteTimeUtc
    $sourceRoots = @(
      (Join-Path $projectRoot "apps\studio\src"),
      (Join-Path $projectRoot "apps\studio\public")
    )
    $sourceRoots += Get-ChildItem -LiteralPath (Join-Path $projectRoot "packages") -Directory |
      ForEach-Object { Join-Path $_.FullName "src" } |
      Where-Object { Test-Path -LiteralPath $_ }
    $newerInput = Get-ChildItem -LiteralPath $sourceRoots -Recurse -File |
      Where-Object { $_.LastWriteTimeUtc -gt $buildTime } |
      Select-Object -First 1
    $needsBuild = $null -ne $newerInput
  }

  if ($needsBuild) {
    Write-Host "Actualizando SolaraCommerce..." -ForegroundColor Cyan
    & corepack pnpm --filter "@solara/studio" build
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo construir la aplicación."
    }
  }

  if (Test-Path -LiteralPath $runtimeFile) {
    try {
      $existing = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
      $existingProcess = Get-Process -Id ([int]$existing.processId) -ErrorAction SilentlyContinue
      if ($existingProcess -and (Test-SolaraServer -Port ([int]$existing.port))) {
        if (Test-SolaraManagedServer -Port ([int]$existing.port)) {
          $existingUrl = "http://127.0.0.1:$($existing.port)"
          if ($NoBrowser) {
            Write-Output $existingUrl
          } else {
            Start-Process $existingUrl
          }
          exit 0
        }
        if ($existing.projectRoot -eq $projectRoot) {
          Stop-Process -Id $existingProcess.Id -Force -ErrorAction SilentlyContinue
          Start-Sleep -Milliseconds 150
        }
      }
    } catch {
      # Un registro viejo no debe impedir iniciar una instancia nueva.
    }
    Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
  }

  $port = 4173..4180 | Where-Object { Test-PortAvailable -Port $_ } | Select-Object -First 1
  if ($null -eq $port) {
    throw "Los puertos locales 4173 a 4180 están ocupados."
  }

  $nodePath = (Get-Command node).Source
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $tokenBytes = New-Object byte[] 32
    $random.GetBytes($tokenBytes)
  } finally {
    $random.Dispose()
  }
  $shutdownToken = [Convert]::ToBase64String($tokenBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  $serverArguments = @(
    "`"$serverScript`"",
    "`"$studioDist`"",
    "$port",
    "`"$shutdownToken`"",
    "`"$projectRoot`""
  )
  $serverProcess = Start-Process `
    -FilePath $nodePath `
    -ArgumentList $serverArguments `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru

  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  @{
    processId = $serverProcess.Id
    port = $port
    projectRoot = $projectRoot
    managed = $true
  } |
    ConvertTo-Json |
    Set-Content -LiteralPath $runtimeFile -Encoding UTF8

  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    $serverProcess.Refresh()
    if ($serverProcess.HasExited) {
      break
    }
    if (Test-SolaraServer -Port $port) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    if (-not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force
    }
    Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
    throw "El servidor local no respondió a tiempo."
  }

  $url = "http://127.0.0.1:$port"
  if ($NoBrowser) {
    Write-Output $url
  } else {
    Start-Process $url
  }
  exit 0
} catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
