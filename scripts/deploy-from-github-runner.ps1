param(
  [string]$Branch = $env:GITHUB_REF_NAME,
  [string]$RepoUrl = "https://github.com/WikE299/MelodyVision.git",
  [string]$DeployDir = "D:/MelodyVision",
  [string]$Port = "3000",
  [string]$AudioPort = "8001",
  [string]$AppName = "melodyvision"
)

$ErrorActionPreference = "Stop"
$AudioTaskName = "$AppName-audio-analysis"
$PreviousCommit = $null
$RepositoryUpdated = $false

function Write-Section([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found."
  }
}

function Stop-PortListeners([string]$TargetPort) {
  $listeners = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $listeners) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-ForHealth([string]$Url, [int]$Attempts = 30) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return $response
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw "Service did not become healthy at $Url"
}

function Restart-Task([string]$TaskName, [string]$TargetPort) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Stop-PortListeners $TargetPort
  Start-ScheduledTask -TaskName $TaskName
}

function Restore-PreviousVersion {
  if (-not $RepositoryUpdated -or -not $PreviousCommit) { return }

  Write-Section "Deployment failed; restoring $PreviousCommit"
  Stop-ScheduledTask -TaskName $AppName -ErrorAction SilentlyContinue
  Stop-ScheduledTask -TaskName $AudioTaskName -ErrorAction SilentlyContinue
  Stop-PortListeners $Port
  Stop-PortListeners $AudioPort

  git reset --hard $PreviousCommit
  if ($LASTEXITCODE -ne 0) { throw "Rollback git reset failed" }
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "Rollback npm ci failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Rollback build failed" }

  Start-ScheduledTask -TaskName $AudioTaskName -ErrorAction SilentlyContinue
  Start-ScheduledTask -TaskName $AppName
  Wait-ForHealth "http://127.0.0.1:$Port/" 30 | Out-Null
  Write-Host "Previous application version restored." -ForegroundColor Yellow
}

if (-not $Branch) { $Branch = "feat/v2-global-musicians" }

Write-Section "Checking server tools"
Require-Command "git"
Require-Command "node"
Require-Command "npm"
Require-Command "py"
$nodeVersionText = ((node -v) -join " ").Trim().TrimStart("v")
if ([version]$nodeVersionText -lt [version]"22.13.0") {
  throw "Node.js 22.13.0 or newer is required for the built-in SQLite research store. Found $nodeVersionText."
}
Write-Host ("node: {0}" -f $nodeVersionText)
Write-Host ("npm: {0}" -f ((npm -v) -join " "))
Write-Host ("git: {0}" -f ((git --version) -join " "))
$pythonVersion = py -3.12 --version
if ($LASTEXITCODE -ne 0) { throw "Python 3.12 is required." }
Write-Host ("python: {0}" -f ($pythonVersion -join " "))

Write-Section "Updating repository"
if (Test-Path (Join-Path $DeployDir ".git")) {
  Push-Location $DeployDir
  $PreviousCommit = (git rev-parse HEAD).Trim()
  git fetch origin
  if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
  git checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }
  git pull --ff-only origin $Branch
  if ($LASTEXITCODE -ne 0) { throw "git pull failed" }
  $RepositoryUpdated = $true
} elseif (Test-Path $DeployDir) {
  $existing = Get-ChildItem -Force $DeployDir | Select-Object -First 1
  if ($existing) { throw "$DeployDir exists but is not a git repository." }
  git clone --branch $Branch $RepoUrl $DeployDir
  if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
  Push-Location $DeployDir
} else {
  git clone --branch $Branch $RepoUrl $DeployDir
  if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
  Push-Location $DeployDir
}

try {
  New-Item -ItemType Directory -Force -Path `
    (Join-Path $DeployDir "data"), `
    (Join-Path $DeployDir "logs/generation-runs"), `
    (Join-Path $DeployDir "public/generated"), `
    (Join-Path $DeployDir ".cache/huggingface") | Out-Null

  if (-not (Test-Path (Join-Path $DeployDir ".env.local"))) {
    throw "$DeployDir/.env.local is missing. Keep server secrets on the server before deploying."
  }

  Write-Section "Installing audio analysis service"
  $audioDir = Join-Path $DeployDir "services/audio-analysis"
  $venvDir = Join-Path $audioDir ".venv"
  $pythonPath = Join-Path $venvDir "Scripts/python.exe"
  if (-not (Test-Path $pythonPath)) {
    py -3.12 -m venv $venvDir
    if ($LASTEXITCODE -ne 0) { throw "Python virtual environment creation failed" }
  }
  $requirementsPath = Join-Path $audioDir "requirements.txt"
  $requirementsStamp = Join-Path $venvDir ".requirements.sha256"
  $requirementsHash = (Get-FileHash $requirementsPath -Algorithm SHA256).Hash
  $installedHash = if (Test-Path $requirementsStamp) { (Get-Content $requirementsStamp -Raw).Trim() } else { "" }
  if ($requirementsHash -ne $installedHash) {
    & $pythonPath -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed" }
    & $pythonPath -m pip install -r $requirementsPath
    if ($LASTEXITCODE -ne 0) { throw "Audio service dependency installation failed" }
    Set-Content -Encoding ASCII -Path $requirementsStamp -Value $requirementsHash
  }

  Write-Section "Building Next.js application"
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

  Write-Section "Registering Windows scheduled tasks"
  $serverLog = Join-Path $DeployDir "logs/server.log"
  $startScript = Join-Path $DeployDir "start-melodyvision.ps1"
  @"
`$ErrorActionPreference = "Stop"
Set-Location "$DeployDir"
`$env:NODE_ENV = "production"
`$env:HOSTNAME = "0.0.0.0"
`$env:PORT = "$Port"
node .\node_modules\next\dist\bin\next start *>> "$serverLog"
"@ | Set-Content -Encoding UTF8 -Path $startScript

  $audioLog = Join-Path $DeployDir "logs/audio-analysis.log"
  $audioStartScript = Join-Path $DeployDir "start-audio-analysis.ps1"
  $hfHome = Join-Path $DeployDir ".cache/huggingface"
  @"
`$ErrorActionPreference = "Stop"
Set-Location "$audioDir"
`$env:HF_HOME = "$hfHome"
`$env:PYTHONUNBUFFERED = "1"
& "$pythonPath" -m uvicorn app.main:app --host 127.0.0.1 --port $AudioPort *>> "$audioLog"
"@ | Set-Content -Encoding UTF8 -Path $audioStartScript

  $startupTrigger = New-ScheduledTaskTrigger -AtStartup
  $appAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
  Register-ScheduledTask -TaskName $AppName -Action $appAction -Trigger $startupTrigger -Description "Run MelodyVision Next.js server" -Force | Out-Null
  $audioAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$audioStartScript`""
  Register-ScheduledTask -TaskName $AudioTaskName -Action $audioAction -Trigger $startupTrigger -Description "Run MelodyVision audio analysis service" -Force | Out-Null

  Write-Section "Starting services"
  Restart-Task $AudioTaskName $AudioPort
  Restart-Task $AppName $Port

  Write-Section "Health checks"
  $audioHealth = Wait-ForHealth "http://127.0.0.1:$AudioPort/health" 120
  $appHealth = Wait-ForHealth "http://127.0.0.1:$Port/" 30
  $audioHealth.Content
  $appHealth | Select-Object StatusCode, StatusDescription
  Get-ScheduledTask -TaskName $AppName, $AudioTaskName | Select-Object TaskName, State
} catch {
  $deploymentError = $_
  Get-Content (Join-Path $DeployDir "logs/audio-analysis.log") -Tail 100 -ErrorAction SilentlyContinue
  Get-Content (Join-Path $DeployDir "logs/server.log") -Tail 100 -ErrorAction SilentlyContinue
  try { Restore-PreviousVersion } catch { Write-Warning "Rollback failed: $_" }
  throw $deploymentError
} finally {
  Pop-Location
}
