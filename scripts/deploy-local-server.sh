#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="melodyvision"
BRANCH="$(git branch --show-current 2>/dev/null || echo feat/v2-global-musicians)"
DEPLOY_DIR="~/MelodyVision"
ENV_FILE=".env.local"
HOST=""
PORT="3000"
REPO_URL="https://github.com/WikE299/MelodyVision.git"
SKIP_ENV_SYNC="false"

usage() {
  cat <<'EOF'
Deploy MelodyVision to a local Linux server over SSH.

Usage:
  scripts/deploy-local-server.sh --host user@server-ip [options]

Required:
  --host USER@HOST        SSH target, for example wangyu@192.168.1.100

Options:
  --dir PATH              Remote deploy directory. Default: ~/MelodyVision
  --branch NAME           Git branch to deploy. Default: current local branch
  --repo URL              Git repo URL. Default: https://github.com/WikE299/MelodyVision.git
  --env-file PATH         Local env file to upload. Default: .env.local
  --port PORT             App port. Default: 3000
  --skip-env-sync         Do not upload .env.local
  -h, --help              Show help

What this script does:
  1. Checks SSH connectivity.
  2. Prints server OS, IP, disk, memory, GPU, Node, npm, git, pm2 info.
  3. Installs basic dependencies when possible on apt-based Linux.
  4. Ensures Node.js 20 through nvm if Node is missing or too old.
  5. Clones or updates the repo.
  6. Uploads the env file unless --skip-env-sync is used.
  7. Runs npm ci, npm run build.
  8. Starts/restarts the app with PM2.

Examples:
  scripts/deploy-local-server.sh --host wangyu@192.168.1.100
  scripts/deploy-local-server.sh --host root@1.2.3.4 --dir /opt/melodyvision --branch feat/v2-global-musicians
EOF
}

log() {
  printf "\n\033[1;34m==>\033[0m %s\n" "$*"
}

die() {
  printf "\n\033[1;31mERROR:\033[0m %s\n" "$*" >&2
  exit 1
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
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -n "$HOST" ]] || die "--host is required. Example: --host wangyu@192.168.1.100"
command -v ssh >/dev/null 2>&1 || die "ssh is not installed locally"
command -v scp >/dev/null 2>&1 || die "scp is not installed locally"
[[ "$SKIP_ENV_SYNC" == "true" || -f "$ENV_FILE" ]] || die "Env file not found: $ENV_FILE"

SSH_OPTS=(-o ConnectTimeout=8)

log "Checking SSH connectivity to $HOST"
ssh "${SSH_OPTS[@]}" "$HOST" "echo connected" >/dev/null ||
  die "SSH connection failed. Check host, username, key, and whether the server allows SSH login."

log "Reading server information"
ssh "$HOST" 'bash -s' <<'REMOTE_INFO'
set -Eeuo pipefail
echo "hostname: $(hostname)"
echo "user: $(whoami)"
echo "kernel: $(uname -a)"
if command -v lsb_release >/dev/null 2>&1; then
  lsb_release -a 2>/dev/null || true
elif [[ -f /etc/os-release ]]; then
  cat /etc/os-release
fi
echo
echo "ip:"
hostname -I 2>/dev/null || true
echo
echo "disk:"
df -h . || true
echo
echo "memory:"
free -h 2>/dev/null || true
echo
echo "gpu:"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader || true
else
  echo "nvidia-smi not found"
fi
echo
echo "tools:"
for cmd in git curl node npm pm2 nginx cloudflared; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf "%s: " "$cmd"
    "$cmd" --version 2>/dev/null | head -1 || true
  else
    echo "$cmd: missing"
  fi
done
REMOTE_INFO

log "Bootstrapping remote dependencies"
ssh "$HOST" "DEPLOY_DIR='$DEPLOY_DIR' REPO_URL='$REPO_URL' BRANCH='$BRANCH' APP_NAME='$APP_NAME' PORT='$PORT' bash -s" <<'REMOTE_BOOTSTRAP'
set -Eeuo pipefail

if command -v apt-get >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    SUDO=""
  fi
  if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    $SUDO apt-get update
    $SUDO apt-get install -y git curl ca-certificates
  fi
fi

export NVM_DIR="$HOME/.nvm"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

NODE_MAJOR="0"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
fi

if [[ "$NODE_MAJOR" -lt 20 ]]; then
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
  fi
  nvm install 20
  nvm use 20
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

DEPLOY_PATH="$(eval echo "$DEPLOY_DIR")"
mkdir -p "$(dirname "$DEPLOY_PATH")"

if [[ -d "$DEPLOY_PATH/.git" ]]; then
  cd "$DEPLOY_PATH"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_PATH"
  cd "$DEPLOY_PATH"
fi

npm ci
npm run build

pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
PORT="$PORT" HOSTNAME="0.0.0.0" pm2 start npm --name "$APP_NAME" -- run start
pm2 save

echo
echo "PM2 status:"
pm2 status "$APP_NAME"
echo
echo "Local service check:"
curl -I "http://127.0.0.1:$PORT/" || true
REMOTE_BOOTSTRAP

if [[ "$SKIP_ENV_SYNC" != "true" ]]; then
  log "Uploading env file to $HOST:$DEPLOY_DIR/.env.local"
  REMOTE_ENV_PATH="$(ssh "$HOST" "python3 - <<PY
import os
print(os.path.expanduser('$DEPLOY_DIR/.env.local'))
PY
")"
  scp "$ENV_FILE" "$HOST:$REMOTE_ENV_PATH" >/dev/null
  log "Restarting app after env sync"
  ssh "$HOST" "pm2 restart '$APP_NAME' --update-env && pm2 save && curl -I 'http://127.0.0.1:$PORT/'"
fi

log "Deployment complete"
cat <<EOF

Next steps:
  - LAN URL is usually: http://<server-ip>:$PORT
  - If the server has a public IP/domain, add Nginx/Caddy reverse proxy to expose port 80/443.
  - If it has no public IP, run Cloudflare Tunnel on the server:
      cloudflared tunnel --url http://localhost:$PORT
  - View logs:
      ssh $HOST "pm2 logs $APP_NAME"
EOF
