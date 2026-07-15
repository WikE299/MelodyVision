# MelodyVision Zero-Cost Online Deployment

This is the primary public deployment path. It uses Vercel for Next.js, a Hugging Face Docker Space for rich audio analysis, and Supabase for PostgreSQL plus generated-image storage.

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

## 2. Hugging Face Space

Create a public Docker Space, for example `WikE299/melodyvision-audio`. CPU Basic is sufficient for the prototype, but it sleeps when unused.

Create a Hugging Face write token, then add these GitHub repository secrets:

```text
HF_TOKEN=<write token>
HF_SPACE_REPO=WikE299/melodyvision-audio
```

In the Space settings add:

```text
AUDIO_ANALYSIS_ALLOWED_ORIGINS=https://<production-project>.vercel.app,http://localhost:3000
```

Run the `Deploy Hugging Face Audio Service` GitHub Action once. It publishes `services/audio-analysis` and rebuilds automatically when that folder changes on `main`.

Verify:

```bash
curl https://<space>.hf.space/health
```

The first build downloads the CLAP model into the Docker image. A cold Space can take several minutes to wake.

## 3. Vercel

Import the GitHub repository into a personal Hobby project and set `main` as the production branch. Configure the following Production environment variables:

```text
DATABASE_PROVIDER=supabase
SUPABASE_DATABASE_URL=<Supavisor transaction-pooler URL>
SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_GENERATED_BUCKET=generated
NEXT_PUBLIC_AUDIO_ANALYSIS_URL=https://<space>.hf.space
AUDIO_ANALYSIS_URL=https://<space>.hf.space
LLM_API_KEY=<server-only key>
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_IMAGE_PROMPT_MODEL=deepseek-v4-flash
DASHSCOPE_API_KEY=<server-only key>
IMAGE_MODEL=wan2.7-image
IMAGE_SIZE=1696*960
JAMENDO_CLIENT_ID=<Jamendo client id>
EXPERIMENT_EXPORT_TOKEN=<long random value>
NEXT_PUBLIC_ALLOW_DEGRADED_AUDIO_ANALYSIS=false
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
- Hugging Face CPU Basic sleeps after inactivity; the page remains available while the analyzer wakes.
- Supabase Free can pause inactive projects and provides limited database, storage, and egress quotas.
- DeepSeek and DashScope usage is billed separately from hosting.

After the online chain is verified, the Windows application, Cloudflare quick tunnel, and self-hosted GitHub runner can be stopped. The Windows deployment workflow remains available only through manual dispatch.
