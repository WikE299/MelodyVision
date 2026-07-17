# MelodyVision Zero-Cost Online Deployment

This is the primary public deployment path. It uses Vercel for Next.js, a Render Free web service for librosa audio analysis, and Supabase for PostgreSQL plus generated-image storage.

## 1. Supabase

Create one Free project in a region near the intended audience. Open SQL Editor and run:

```text
supabase/migrations/20260715000000_melodyvision_schema.sql
```

The migration creates the research tables, indexes, the public `generated` bucket, and read-only public access for generated artwork. Uploads still require the Service Role key.

Collect these values from Project Settings:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DATABASE_URL
```

Use the Supavisor transaction-pooler connection string for `SUPABASE_DATABASE_URL`. Do not expose either database secret to the browser.

## 2. Render audio service

Create a Render Blueprint from this repository and select `render.yaml`. The Blueprint creates the public `melodyvision-audio` Docker web service on the Free plan in Singapore.

The Render image uses `services/audio-analysis/Dockerfile.render`. It keeps the librosa signal, rhythm, tonality, dynamics, timbre, and section analysis while disabling CLAP and its PyTorch runtime so the service fits the Free instance's 512 MB memory limit.

The Blueprint configures:

```text
CLAP_DISABLED=1
CLAP_PRELOAD=0
AUDIO_ANALYSIS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
AUDIO_ANALYSIS_ALLOWED_ORIGIN_REGEX=^https://melodyvision(?:-[a-z0-9-]+)?\.vercel\.app$
```

Render deploys automatically from `main` after the Version 2 pull request is merged.

Verify:

```bash
curl https://melodyvision-audio.onrender.com/health
```

Free Render web services sleep after 15 minutes without inbound traffic. A cold service typically takes about one minute to wake.

## 3. Vercel

Import the GitHub repository into a personal Hobby project and set `main` as the production branch. Configure the following Production environment variables:

```text
DATABASE_PROVIDER=supabase
SUPABASE_DATABASE_URL=<Supavisor transaction-pooler URL>
SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_GENERATED_BUCKET=generated
NEXT_PUBLIC_AUDIO_ANALYSIS_URL=https://melodyvision-audio.onrender.com
AUDIO_ANALYSIS_URL=https://melodyvision-audio.onrender.com
LLM_API_KEY=<server-only key>
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_IMAGE_PROMPT_MODEL=deepseek-v4-flash
DASHSCOPE_API_KEY=<server-only key>
IMAGE_MODEL=wan2.7-image
IMAGE_SIZE=1696*960
JAMENDO_CLIENT_ID=<Jamendo client id>
EXPERIMENT_EXPORT_TOKEN=<long random value>
```

`NEXT_PUBLIC_AUDIO_ANALYSIS_URL` is embedded at build time. Redeploy after changing it. Keep Preview deployments without production secrets unless they intentionally share the same research database.

Verify the deployed application:

```bash
curl https://<production-project>.vercel.app/api/readiness
```

Expected status after the Space is warm:

```json
{
  "status": "ready",
  "app": { "status": "ok" },
  "database": { "status": "ok", "provider": "supabase" },
  "audioAnalysis": { "status": "ok" },
  "storage": { "status": "configured" }
}
```

## Data Flow

- Uploads go directly from the browser to `POST <space>/analyze`.
- Jamendo search stays on `/api/music/search`; the Space receives an allowlisted URL through `POST <space>/analyze-remote`.
- LLM and image generation calls remain server-side on Vercel.
- The temporary DashScope image is copied to Supabase before `/api/generate` returns.
- Successful generation logs are stored in `generation_runs.run_log_json`.
- Local development continues to use SQLite and `public/generated` unless `DATABASE_PROVIDER=supabase` is set.

## Release Checks

```bash
npm test
npm run lint
npm run build
cd services/audio-analysis
.venv/bin/python -m unittest discover -s tests -v
```

Test MP3, WAV, FLAC, OGG, a Jamendo result, image persistence after refresh, feedback, experiment export, and a cold Space wake-up before sharing the link.

## Free-Tier Limits

- Vercel Hobby is for personal, non-commercial use and does not provide a production SLA.
- Render Free sleeps after 15 minutes of inactivity and provides 512 MB RAM, so the hosted analyzer intentionally omits CLAP.
- Supabase Free can pause inactive projects and provides limited database, storage, and egress quotas.
- DeepSeek and DashScope usage is billed separately from hosting.

After the online chain is verified, the Windows application, Cloudflare quick tunnel, and self-hosted GitHub runner can be stopped. The Windows deployment workflow remains available only through manual dispatch.
