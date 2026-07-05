param(
  [string]$Branch = $env:GITHUB_REF_NAME,
  [string]$RepoUrl = "https://github.com/WikE299/MelodyVision.git",
  [string]$DeployDir = "D:/MelodyVision",
  [string]$Port = "3000",
  [string]$AppName = "melodyvision"
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found."
  }
}

if (-not $Branch) {
  $Branch = "feat/v2-global-musicians"
}

Write-Section "Checking server tools"
Require-Command "git"
Require-Command "node"
Require-Command "npm"
Write-Host ("node: {0}" -f ((node -v) -join " "))
Write-Host ("npm: {0}" -f ((npm -v) -join " "))
Write-Host ("git: {0}" -f ((git --version) -join " "))

Write-Section "Updating repository"
if (Test-Path (Join-Path $DeployDir ".git")) {
  Push-Location $DeployDir
  git fetch origin
  git checkout $Branch
  git pull --ff-only origin $Branch
  Pop-Location
} elseif (Test-Path $DeployDir) {
  $existing = Get-ChildItem -Force $DeployDir | Select-Object -First 1
  if ($existing) {
    throw "$DeployDir exists but is not a git repository."
  }
  git clone --branch $Branch $RepoUrl $DeployDir
} else {
  git clone --branch $Branch $RepoUrl $DeployDir
}

New-Item -ItemType Directory -Force -Path `
  (Join-Path $DeployDir "data"), `
  (Join-Path $DeployDir "logs/generation-runs"), `
  (Join-Path $DeployDir "public/generated") | Out-Null

if (-not (Test-Path (Join-Path $DeployDir ".env.local"))) {
  throw "$DeployDir/.env.local is missing. Keep server secrets on the server before deploying."
}

Write-Section "Building application"
Push-Location $DeployDir
npm ci
npm run build

Write-Section "Restarting Windows scheduled task"
$startScript = Join-Path $DeployDir "start-melodyvision.ps1"
$serverLog = Join-Path $DeployDir "logs/server.log"
@"
`$ErrorActionPreference = "Stop"
Set-Location "$DeployDir"
`$env:NODE_ENV = "production"
`$env:HOSTNAME = "0.0.0.0"
`$env:PORT = "$Port"
node .\node_modules\next\dist\bin\next start *>> "$serverLog"
"@ | Set-Content -Encoding UTF8 -Path $startScript

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $listeners) {
  if ($processId -and $processId -ne $PID) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName $AppName -Action $taskAction -Trigger $taskTrigger -Description "Run MelodyVision Next.js server" -Force | Out-Null
Start-ScheduledTask -TaskName $AppName

Write-Section "Health check"
$response = $null
for ($attempt = 1; $attempt -le 20; $attempt++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -Method Head
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $response) {
  Get-Content $serverLog -Tail 80 -ErrorAction SilentlyContinue
  throw "Service did not respond on http://127.0.0.1:$Port/"
}

$response | Select-Object StatusCode,StatusDescription
Get-ScheduledTask -TaskName $AppName | Select-Object TaskName,State
Pop-Location
