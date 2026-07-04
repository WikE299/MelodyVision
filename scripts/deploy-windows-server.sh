#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="melodyvision"
BRANCH="$(git branch --show-current 2>/dev/null || echo feat/v2-global-musicians)"
DEPLOY_DIR="C:/MelodyVision"
ENV_FILE=".env.local"
HOST=""
PORT="3000"
REPO_URL="https://github.com/WikE299/MelodyVision.git"
SKIP_ENV_SYNC="false"
SKIP_FIREWALL="false"
CHECK_ONLY="false"

usage() {
  cat <<'EOF'
Deploy MelodyVision to a Windows server over SSH.

Run this script from your local machine, not inside the server.

Usage:
  scripts/deploy-windows-server.sh --host Administrator@10.194.113.235 [options]

Required:
  --host USER@HOST        SSH target, for example Administrator@10.194.113.235

Options:
  --dir PATH              Remote deploy directory. Default: C:/MelodyVision
  --branch NAME           Git branch to deploy. Default: current local branch
  --repo URL              Git repo URL. Default: https://github.com/WikE299/MelodyVision.git
  --env-file PATH         Local env file to upload. Default: .env.local
  --port PORT             App port. Default: 3000
  --skip-env-sync         Do not upload .env.local
  --skip-firewall         Do not create a Windows firewall rule for the app port
  --check-only            Only check SSH and server tools; do not deploy
  -h, --help              Show help

What this script does:
  1. Checks SSH connectivity.
  2. Uploads a temporary PowerShell deploy helper to the server.
  3. Prints server, Node, npm, git, PM2, and GPU information.
  4. Clones or updates the GitHub branch on the server.
  5. Uploads .env.local unless --skip-env-sync is used.
  6. Runs npm ci and npm run build.
  7. Starts or restarts the app with PM2 on 0.0.0.0:3000.
  8. Opens the Windows firewall port unless --skip-firewall is used.

Example:
  scripts/deploy-windows-server.sh --host Administrator@10.194.113.235
EOF
}

log() {
  printf "\n\033[1;34m==>\033[0m %s\n" "$*"
}

die() {
  printf "\n\033[1;31mERROR:\033[0m %s\n" "$*" >&2
  exit 1
}

remote_powershell_quote() {
  printf '"%s"' "$(printf "%s" "$1" | sed 's/"/\\"/g')"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --dir)
      DEPLOY_DIR="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --skip-env-sync)
      SKIP_ENV_SYNC="true"
      shift
      ;;
    --skip-firewall)
      SKIP_FIREWALL="true"
      shift
      ;;
    --check-only)
      CHECK_ONLY="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$HOST" ]] || die "--host is required. Example: --host Administrator@10.194.113.235"
command -v ssh >/dev/null 2>&1 || die "ssh is not installed locally"
command -v scp >/dev/null 2>&1 || die "scp is not installed locally"
[[ "$SKIP_ENV_SYNC" == "true" || -f "$ENV_FILE" ]] || die "Env file not found: $ENV_FILE"

REMOTE_SCRIPT="C:/Windows/Temp/melodyvision-deploy.ps1"
LOCAL_SCRIPT="$(mktemp)"
trap 'rm -f "$LOCAL_SCRIPT"' EXIT

cat >"$LOCAL_SCRIPT" <<'POWERSHELL'
param(
  [Parameter(Mandatory = $true)][ValidateSet("doctor", "prepare", "start")][string]$Phase,
  [Parameter(Mandatory = $true)][string]$RepoUrl,
  [Parameter(Mandatory = $true)][string]$Branch,
  [Parameter(Mandatory = $true)][string]$DeployDir,
  [Parameter(Mandatory = $true)][string]$Port,
  [Parameter(Mandatory = $true)][string]$AppName,
  [Parameter(Mandatory = $true)][string]$SkipFirewall
)

$ErrorActionPreference = "Stop"

function Write-Section([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is missing. $InstallHint"
  }
}

function Print-Tool([string]$Name, [string]$Command) {
  try {
    $value = Invoke-Expression $Command
    Write-Host ("{0}: {1}" -f $Name, (($value | Select-Object -First 1) -join " "))
  } catch {
    Write-Host ("{0}: missing" -f $Name)
  }
}

Write-Section "Server information"
Write-Host ("hostname: {0}" -f $env:COMPUTERNAME)
Write-Host ("user: {0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
Write-Host ("deployDir: {0}" -f $DeployDir)
Write-Host ("branch: {0}" -f $Branch)
Write-Host ("port: {0}" -f $Port)
Print-Tool "node" "node -v"
Print-Tool "npm" "npm -v"
Print-Tool "git" "git --version"
Print-Tool "pm2" "pm2 -v"

if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  Write-Host ""
  Write-Host "gpu:"
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
}

Require-Command "git" "Install Git for Windows first."
Require-Command "node" "Install Node.js 20 first."
Require-Command "npm" "Install npm first."

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]") -join "")
if ($nodeMajor -lt 20) {
  throw "Node.js 20+ is required. Current major version is $nodeMajor."
}

if ($Phase -eq "doctor") {
  exit 0
}

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Section "Installing PM2"
  npm install -g pm2
}

if ($Phase -eq "prepare") {
  Write-Section "Preparing repository"
  if (Test-Path (Join-Path $DeployDir ".git")) {
    Push-Location $DeployDir
    git fetch origin
    git checkout $Branch
    git pull --ff-only origin $Branch
    Pop-Location
  } elseif (Test-Path $DeployDir) {
    $existing = Get-ChildItem -Force $DeployDir | Select-Object -First 1
    if ($existing) {
      throw "$DeployDir exists but is not a git repository. Move or remove it before deploying."
    }
    git clone --branch $Branch $RepoUrl $DeployDir
  } else {
    git clone --branch $Branch $RepoUrl $DeployDir
  }

  New-Item -ItemType Directory -Force -Path `
    (Join-Path $DeployDir "data"), `
    (Join-Path $DeployDir "logs/generation-runs"), `
    (Join-Path $DeployDir "public/generated") | Out-Null
  exit 0
}

Write-Section "Installing dependencies and building"
Push-Location $DeployDir
npm ci
npm run build

Write-Section "Starting app with PM2"
$env:PORT = $Port
$env:HOSTNAME = "0.0.0.0"
$pm2List = pm2 jlist | ConvertFrom-Json
$existingProcess = $pm2List | Where-Object { $_.name -eq $AppName } | Select-Object -First 1
if ($existingProcess) {
  pm2 delete $AppName
}
pm2 start npm --name $AppName -- run start
pm2 save

if ($SkipFirewall -ne "true") {
  Write-Section "Ensuring Windows firewall rule"
  $ruleName = "$AppName-$Port"
  $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (-not $rule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
  }
}

Write-Section "Service check"
Start-Sleep -Seconds 3
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -Method Head | Select-Object StatusCode,StatusDescription
pm2 status $AppName
Pop-Location
POWERSHELL

SSH_OPTS=(-o ConnectTimeout=8)

log "Checking SSH connectivity to $HOST"
ssh "${SSH_OPTS[@]}" "$HOST" "powershell -NoProfile -Command \"Write-Output connected\"" >/dev/null ||
  die "SSH connection failed. Check username, host, key/password, and whether Windows OpenSSH Server is running."

log "Uploading deploy helper to $HOST"
scp "$LOCAL_SCRIPT" "$HOST:$REMOTE_SCRIPT" >/dev/null

run_remote_phase() {
  local phase="$1"
  ssh "$HOST" "powershell -NoProfile -ExecutionPolicy Bypass -File $(remote_powershell_quote "$REMOTE_SCRIPT") -Phase $(remote_powershell_quote "$phase") -RepoUrl $(remote_powershell_quote "$REPO_URL") -Branch $(remote_powershell_quote "$BRANCH") -DeployDir $(remote_powershell_quote "$DEPLOY_DIR") -Port $(remote_powershell_quote "$PORT") -AppName $(remote_powershell_quote "$APP_NAME") -SkipFirewall $(remote_powershell_quote "$SKIP_FIREWALL")"
}

if [[ "$CHECK_ONLY" == "true" ]]; then
  log "Checking server tools only"
  run_remote_phase "doctor"
  log "Check complete"
  exit 0
fi

log "Preparing repository on server"
run_remote_phase "prepare"

if [[ "$SKIP_ENV_SYNC" != "true" ]]; then
  REMOTE_ENV_PATH="${DEPLOY_DIR%/}/.env.local"
  log "Uploading env file to $HOST:$REMOTE_ENV_PATH"
  scp "$ENV_FILE" "$HOST:$REMOTE_ENV_PATH" >/dev/null
fi

log "Building and starting MelodyVision"
run_remote_phase "start"

log "Deployment complete"
cat <<EOF

Try it on the same LAN:
  http://10.194.113.235:$PORT

Useful commands:
  ssh $HOST "pm2 status $APP_NAME"
  ssh $HOST "pm2 logs $APP_NAME"
  ssh $HOST "pm2 restart $APP_NAME --update-env"
EOF
