param(
  [switch]$NoBrowser,
  [switch]$NewSession,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$studioDist = Join-Path $projectRoot "apps\studio\dist"
$studioIndex = Join-Path $studioDist "index.html"
$serverScript = Join-Path $projectRoot "packages\exporter\scripts\serve.mjs"
$runtimeDirectory = Join-Path $projectRoot ".solara-runtime"
$instancesDirectory = Join-Path $runtimeDirectory "instances"
$legacyRuntimeFile = Join-Path $runtimeDirectory "server.json"

function Write-LauncherStatus {
  param([string]$Message)
  if (-not $Json) {
    Write-Host $Message -ForegroundColor Cyan
  }
}

function Get-SolaraSession {
  param([int]$Port)

  try {
    return Invoke-RestMethod `
      -Uri "http://127.0.0.1:$Port/__solara/session" `
      -Method Get `
      -UseBasicParsing `
      -TimeoutSec 1
  } catch {
    return $null
  }
}

function Test-SolaraManagedSession {
  param(
    [int]$Port,
    [string]$SessionId
  )

  $session = Get-SolaraSession -Port $Port
  return $null -ne $session -and $session.managed -eq $true -and $session.sessionId -eq $SessionId
}

function Test-SolaraManagedLegacyServer {
  param([int]$Port)

  $session = Get-SolaraSession -Port $Port
  return $null -ne $session -and $session.managed -eq $true
}

function Remove-StaleSessionRecord {
  param([string]$Path)
  Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

function Get-LiveSessions {
  New-Item -ItemType Directory -Path $instancesDirectory -Force | Out-Null
  $live = @()
  foreach ($file in Get-ChildItem -LiteralPath $instancesDirectory -Filter "*.json" -File -ErrorAction SilentlyContinue) {
    try {
      $record = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
      $validShape =
        $record.format -eq "solara-local-session" -and
        [int]$record.version -eq 1 -and
        $record.managed -eq $true -and
        $record.projectRoot -eq $projectRoot -and
        [int]$record.port -ge 1 -and
        [int]$record.port -le 65535 -and
        $record.sessionId -match '^[a-zA-Z0-9_-]{8,128}$' -and
        -not [string]::IsNullOrWhiteSpace([string]$record.shutdownToken)
      if (-not $validShape) {
        throw "Registro inválido."
      }
      if (Test-SolaraManagedSession -Port ([int]$record.port) -SessionId ([string]$record.sessionId)) {
        $live += $record
      } else {
        Remove-StaleSessionRecord -Path $file.FullName
      }
    } catch {
      Remove-StaleSessionRecord -Path $file.FullName
    }
  }
  return @($live | Sort-Object @{ Expression = { [int]$_.port } }, startedAt)
}

function Get-LegacyServerUrl {
  if (-not (Test-Path -LiteralPath $legacyRuntimeFile)) {
    return $null
  }
  try {
    $legacy = Get-Content -LiteralPath $legacyRuntimeFile -Raw | ConvertFrom-Json
    if (
      $legacy.projectRoot -eq $projectRoot -and
      [int]$legacy.port -ge 1 -and
      [int]$legacy.port -le 65535 -and
      (Test-SolaraManagedLegacyServer -Port ([int]$legacy.port))
    ) {
      return "http://127.0.0.1:$([int]$legacy.port)"
    }
  } catch {
    # El registro legacy es regenerable; un JSON roto nunca bloquea el arranque.
  }
  Remove-Item -LiteralPath $legacyRuntimeFile -Force -ErrorAction SilentlyContinue
  return $null
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

function Write-LaunchResult {
  param(
    [string]$SessionId,
    [int]$Port,
    [string]$Url
  )

  if ($Json) {
    [pscustomobject]@{
      sessionId = $SessionId
      port = $Port
      url = $Url
    } | ConvertTo-Json -Compress | Write-Output
  } elseif ($NoBrowser) {
    Write-Output $Url
  } else {
    Start-Process $Url
  }
}

try {
  Set-Location -LiteralPath $projectRoot

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 24.x no está instalado o no está disponible en PATH."
  }
  $nodeVersion = & node -v
  if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
    throw "No se pudo verificar la versión de Node.js instalada."
  }
  $nodeMajor = [int]($nodeVersion -replace "^v(\d+).*", '$1')
  if ($nodeMajor -ne 24) {
    throw "Se requiere Node.js 24.x; la versión instalada es $nodeVersion."
  }
  if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
    throw "Corepack no está disponible. Instalá una versión actual de Node.js."
  }

  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules\.modules.yaml"))) {
    Write-LauncherStatus "Preparando dependencias por primera vez..."
    if ($Json) {
      & corepack pnpm install --frozen-lockfile *> $null
    } else {
      & corepack pnpm install --frozen-lockfile
    }
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
    Write-LauncherStatus "Actualizando SolaraCommerce..."
    if ($Json) {
      & corepack pnpm --filter "@solara/studio" build *> $null
    } else {
      & corepack pnpm --filter "@solara/studio" build
    }
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo construir la aplicación."
    }
  }

  $liveSessions = @(Get-LiveSessions)
  if (-not $NewSession -and $liveSessions.Count -gt 0) {
    $existing = $liveSessions[0]
    $existingUrl = "http://127.0.0.1:$([int]$existing.port)"
    Write-LaunchResult -SessionId ([string]$existing.sessionId) -Port ([int]$existing.port) -Url $existingUrl
    exit 0
  }

  if (-not $NewSession) {
    $legacyUrl = Get-LegacyServerUrl
    if ($legacyUrl) {
      $legacyPort = [int]([Uri]$legacyUrl).Port
      Write-LaunchResult -SessionId "legacy" -Port $legacyPort -Url $legacyUrl
      exit 0
    }
  }

  $port = 4173..4180 | Where-Object { Test-PortAvailable -Port $_ } | Select-Object -First 1
  if ($null -eq $port) {
    throw "Los puertos locales 4173 a 4180 están ocupados."
  }
  $port = [int]$port

  $nodePath = (Get-Command node).Source
  $sessionId = [Guid]::NewGuid().ToString("N")
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
    "`"$projectRoot`"",
    "`"$sessionId`""
  )
  $serverProcess = Start-Process `
    -FilePath $nodePath `
    -ArgumentList $serverArguments `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    $serverProcess.Refresh()
    if ($serverProcess.HasExited) {
      break
    }
    if (Test-SolaraManagedSession -Port $port -SessionId $sessionId) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    if (-not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-StaleSessionRecord -Path (Join-Path $instancesDirectory "$sessionId.json")
    throw "El servidor local no respondió a tiempo."
  }

  $url = "http://127.0.0.1:$port"
  Write-LaunchResult -SessionId $sessionId -Port $port -Url $url
  exit 0
} catch {
  if ($Json) {
    [Console]::Error.WriteLine($_.Exception.Message)
  } else {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  }
  exit 1
}
