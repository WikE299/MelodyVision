# MelodyVision Deployment Notes

The primary public deployment uses Vercel + Supabase, including a Vercel Python
Function for librosa analysis. See [deployment-online.md](./deployment-online.md).
The Windows instructions below are retained as a manual fallback and are no
longer triggered by GitHub pushes.

Last updated: 2026-07-11

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
- Running the Version 2 Python audio analyzer through a second Scheduled Task named `melodyvision-audio-analysis`.
- Rolling back the repository and rebuilding the previous commit when a deployment health check fails.

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
EXPERIMENT_EXPORT_TOKEN=<long-random-server-secret>
IMAGE_SIZE=1696*960
```

These are server-only values. Do not prefix them with `NEXT_PUBLIC_`. Research exports require either `Authorization: Bearer <token>` or `x-export-token: <token>`.

`IMAGE_SIZE` controls the generated artwork dimensions. Version 2 defaults to `1696*960` for a wide 16:9 result; keep the same value on local and server deployments so regeneration and research logs remain comparable.

## Version 2 Audio Service

The deployment script requires Node.js 22.13 or newer and Python 3.12 through the Windows `py` launcher. Node 22.13+ is required by the built-in SQLite research store. The script creates `services/audio-analysis/.venv`, installs dependencies when `requirements.txt` changes, and starts the analyzer on `127.0.0.1:8001`.

For local Version 2 development, `npm run dev` starts both the Python analyzer and Next.js after the Python 3.12 virtual environment has been created. `npm run dev:full` is an alias for the same combined command. To start the services separately, run the analyzer first:

```bash
cd services/audio-analysis
CLAP_DISABLED=1 CLAP_PRELOAD=0 HF_HOME=.cache/huggingface .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Then run `npm run dev:web` from the repository root. Check the proxy with:

```bash
curl http://127.0.0.1:3000/api/analyze
```

The combined development command uses deterministic local defaults so startup does not wait for a model download. Set `CLAP_DISABLED=0 CLAP_PRELOAD=1` explicitly only after the CLAP model is cached.

Formal studies and public deployment require the rich analyzer. In ordinary demo mode only, a locally available audio file can fall back to the browser Meyda analyzer if the rich service fails; that degraded result is visibly marked and does not create a formal StudyTrial.

The deployment is considered healthy only when both `/health` on port `8001` and the Next.js root on port `3000` respond. The first analyzer start may download and warm the CLAP model, so its health-check window is four minutes. A failed check restores and rebuilds the pre-deployment Git commit.

Uploaded audio is not retained. The analyzer deletes its temporary input after every request, including failed requests. SQLite stores only file metadata, the structured `MusicProfile`, compatibility analysis, conversation snapshots, VisualBrief versions, interaction events, generation results, and feedback.

Export research data:

```powershell
$headers = @{ Authorization = "Bearer $env:EXPERIMENT_EXPORT_TOKEN" }
Invoke-WebRequest -Headers $headers -Uri "http://127.0.0.1:3000/api/experiment/export" -OutFile experiment.json
Invoke-WebRequest -Headers $headers -Uri "http://127.0.0.1:3000/api/experiment/export?format=csv" -OutFile experiment.csv
```

Changing model names or API keys:

- If the setting is in code, edit locally and push.
- If the setting is in `.env.local`, update the server file and redeploy or restart the app.

## Useful Server Commands

Check MelodyVision task:

```powershell
Get-ScheduledTask -TaskName melodyvision
Get-ScheduledTask -TaskName melodyvision-audio-analysis
```

Restart MelodyVision:

```powershell
Start-ScheduledTask -TaskName melodyvision
```

View app logs:

```powershell
Get-Content D:/MelodyVision/logs/server.log -Tail 120
Get-Content D:/MelodyVision/logs/audio-analysis.log -Tail 120
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
- The last recorded server Node version is `20.18.0`. It must be upgraded to Node 22.13+ before deploying Version 2; the deployment script stops with an explicit error otherwise.
- The first Python deployment can take several minutes while PyTorch/CLAP dependencies and model weights are installed.
- The deployment script has been statically reviewed on macOS; its Scheduled Task and rollback paths must be observed on the first Windows deployment.
- `npm audit` currently reports low/moderate dependency warnings.

## Recommended Next Steps

- Keep using quick tunnel while the project is in demo/prototype stage.
- Consider image/audio asset optimization before wider sharing.
- Upgrade server Node.js to the current Node 22 or 24 LTS before the first Version 2 deployment.
- If the project needs a permanent public URL, buy a domain and configure a named Cloudflare Tunnel.
