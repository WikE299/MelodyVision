# MelodyVision Deployment Notes

Last updated: 2026-07-05

## Current Deployment

MelodyVision is deployed on the local Windows 5090 server.

Server:

```text
Host: RTX5090-Workstation-CatLab
SSH user: Administrator
LAN IP: 10.194.113.235
Project path: D:/MelodyVision
App port: 3000
```

Access URLs:

```text
LAN: http://10.194.113.235:3000
Cloudflare quick tunnel: https://navigator-prix-executives-zoning.trycloudflare.com
```

The Cloudflare URL is a temporary quick tunnel URL. It can change after the tunnel is restarted.

## What Has Been Set Up

The server currently supports:

- Running the Next.js production app from `D:/MelodyVision`.
- Starting MelodyVision with a Windows Scheduled Task named `melodyvision`.
- Exposing the app to the public internet through Cloudflare Tunnel.
- Running a GitHub Actions self-hosted runner on the server.
- Automatically deploying when code is pushed to `feat/v2-global-musicians`.

GitHub Actions runner:

```text
Runner name: melodyvision-rtx5090
Labels: self-hosted, Windows, X64, melodyvision
Runner path: D:/actions-runner
Runner task: melodyvision-github-runner
```

Cloudflare Tunnel:

```text
cloudflared: D:/Tools/cloudflared/cloudflared.exe
Tunnel task: melodyvision-cloudflare-tunnel
Tunnel script: D:/MelodyVision/start-cloudflare-tunnel.ps1
Tunnel log: D:/MelodyVision/logs/cloudflared.log
Protocol: quic
Target: http://localhost:3000
```

## Normal Development Flow

For code changes, use this flow:

```text
Edit locally
Run local checks
Commit
Push to GitHub
GitHub Actions deploys to the server automatically
```

Typical commands:

```bash
npm run lint
npm run build
git add <files>
git commit -m "Describe the change"
git push origin feat/v2-global-musicians
```

After the push, GitHub Actions will:

```text
Pull latest code on the server
Stop the old app process on port 3000
Run npm ci
Run npm run build
Restart the Windows Scheduled Task
Check http://127.0.0.1:3000
```

For normal feature work, the local computer does not need to be on the same LAN as the server. The server receives deployment jobs from GitHub through the self-hosted runner.

## What Still Requires Server Access

Some operations still require access to the server by SSH, ToDesk, or being on the same LAN:

- Updating `D:/MelodyVision/.env.local`.
- Replacing API keys.
- Checking detailed server logs.
- Restarting the GitHub Actions runner if it goes offline.
- Restarting Cloudflare Tunnel if the temporary link breaks.
- Uploading large files that are not committed to GitHub.
- Fixing server network, sleep, Windows login, or hardware issues.

If ToDesk is working, these tasks can be done remotely. If ToDesk and SSH are both unavailable, physical access to the server may be needed.

## Environment Variables

Secrets are kept on the server in:

```text
D:/MelodyVision/.env.local
```

Do not commit API keys to GitHub.

Version 2 rich audio analysis also uses:

```text
AUDIO_ANALYSIS_URL=http://127.0.0.1:8001
```

This is a server-only value read by the Next.js `/api/analyze` proxy. Do not prefix it with `NEXT_PUBLIC_`.

## Version 2 Audio Service

For local Version 2 development, start the Python analyzer before Next.js:

```bash
cd services/audio-analysis
HF_HOME=.cache/huggingface .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Then run `npm run dev` from the repository root. Check the proxy with:

```bash
curl http://127.0.0.1:3000/api/analyze
```

The current Windows deployment script still manages only the Next.js process. Until the Python service receives its scheduled-task deployment in `V2-12`, a server without port `8001` will use the explicitly marked Meyda degraded path. The user flow remains available, but it will not receive the rich `MusicProfile`.

Changing model names or API keys:

- If the setting is in code, edit locally and push.
- If the setting is in `.env.local`, update the server file and redeploy or restart the app.

## Useful Server Commands

Check MelodyVision task:

```powershell
Get-ScheduledTask -TaskName melodyvision
```

Restart MelodyVision:

```powershell
Start-ScheduledTask -TaskName melodyvision
```

View app logs:

```powershell
Get-Content D:/MelodyVision/logs/server.log -Tail 120
```

Check GitHub runner:

```powershell
Get-ScheduledTask -TaskName melodyvision-github-runner
Get-Content D:/actions-runner/runner.log -Tail 120
```

Check Cloudflare Tunnel:

```powershell
Get-ScheduledTask -TaskName melodyvision-cloudflare-tunnel
Get-Content D:/MelodyVision/logs/cloudflared.log -Tail 160
```

Find current Cloudflare quick tunnel URL:

```powershell
Select-String -Path D:/MelodyVision/logs/cloudflared.log -Pattern "trycloudflare.com" | Select-Object -Last 5
```

## Known Limitations

- The current Cloudflare URL is temporary and may change after tunnel restart.
- The server must stay powered on and connected to the internet.
- Cloudflare quick tunnels have no uptime guarantee.
- The GitHub runner must remain online for automatic deployment.
- Large untracked audio files are not deployed through GitHub unless committed or uploaded separately.
- Node on the server is currently `20.18.0`; some dependencies warn that `20.19.0+` is preferred.
- `npm audit` currently reports low/moderate dependency warnings.

## Recommended Next Steps

- Keep using quick tunnel while the project is in demo/prototype stage.
- Consider image/audio asset optimization before wider sharing.
- Upgrade server Node.js to `20.19.0+` later.
- If the project needs a permanent public URL, buy a domain and configure a named Cloudflare Tunnel.
