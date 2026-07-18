# MelodyVision Zero-Cost Online Deployment

The public deployment uses Vercel for Next.js and librosa analysis, plus
Supabase for PostgreSQL, temporary audio transfer, and generated-image storage.
It does not require Render, a credit card, a custom domain, or a continuously
running server.

## 1. Supabase

Create one Free project and apply:

```text
supabase/migrations/20260715000000_melodyvision_schema.sql
supabase/migrations/20260717000000_audio_analysis_storage.sql
```

The migrations create the research tables, the public `generated` artwork
bucket, and a private `audio-analysis` bucket. Audio objects are limited to
20 MB and deleted after analysis.

Collect:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DATABASE_URL
```

Use the Supavisor transaction-pooler URL for `SUPABASE_DATABASE_URL`. The
database password and Service Role key must remain server-only.

## 2. Vercel

Import the GitHub repository into a personal Hobby project and use `main` as
the production branch. Configure these Production environment variables:

```text
DATABASE_PROVIDER=supabase
SUPABASE_DATABASE_URL=<Supavisor transaction-pooler URL>
SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_GENERATED_BUCKET=generated
SUPABASE_AUDIO_BUCKET=audio-analysis
AUDIO_ANALYSIS_PROVIDER=vercel-python
NEXT_PUBLIC_AUDIO_ANALYSIS_PROVIDER=vercel-python
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

Do not set `AUDIO_ANALYSIS_URL` or `NEXT_PUBLIC_AUDIO_ANALYSIS_URL` in
production. `NEXT_PUBLIC_AUDIO_ANALYSIS_PROVIDER` is embedded at build time, so
redeploy after changing it.

`api/audio-profile.py` runs on Vercel Python 3.12. It reuses the deterministic
librosa analyzer from `services/audio-analysis`; CLAP remains disabled to keep
the free function bundle and cold start under control.

Verify:

```bash
curl https://<production-project>.vercel.app/api/readiness
```

Expected result:

```json
{
  "status": "ready",
  "app": { "status": "ok" },
  "database": { "status": "ok", "provider": "supabase" },
  "audioAnalysis": { "status": "ok", "provider": "vercel-python" },
  "storage": { "status": "configured" }
}
```

## Data Flow

- The browser requests a two-hour signed upload URL from
  `/api/audio/upload-ticket`, then uploads directly to the private Supabase
  bucket. Audio bytes do not pass through a Next.js Function.
- The browser sends only the private object path to `/api/audio-profile`.
- Jamendo search sends an allowlisted HTTPS URL to the Python Function, which
  downloads at most 20 MB.
- The Python Function analyzes at most the first 60 seconds and deletes the raw
  audio object in a `finally` block.
- LLM and image generation calls remain server-side on Vercel.
- The temporary DashScope image is copied to Supabase before `/api/generate`
  returns.
- Successful generation logs are stored in `generation_runs.run_log_json`.
- Local development continues to use the standalone Python service, SQLite,
  and `public/generated` unless production providers are explicitly enabled.

## Release Checks

```bash
npm test
npm run lint
npm run build
cd services/audio-analysis
.venv/bin/python -m unittest discover -s tests -v
```

Test MP3, WAV, FLAC, OGG, a Jamendo result, persistence after refresh,
feedback, experiment export, and a cold Python Function invocation.

## GitHub Release Flow

Normal production changes use:

```text
codex/<task>
-> pull request
-> required Node, Python, and migration checks
-> Vercel Preview review when the change is user-facing or high-risk
-> merge to main
-> Vercel production deployment
-> automatic real-audio production smoke test
```

The Vercel GitHub App is connected to `WikE299/MelodyVision`, and `main` is the
production branch. Normal releases do not require a local Vercel CLI deployment.
Keep `npx vercel deploy --prod --yes` only as a documented fallback when the Git
integration is unavailable.

The GitHub repository variable `PRODUCTION_BASE_URL` must point to the public
production alias. The automatic smoke test uses that alias because Vercel's
deployment-specific production URL may require SSO even when the public alias
is accessible.

The smoke workflow can also be started manually from GitHub Actions with a
specific public URL. It checks the Python analyzer, uploads and analyzes a
short tracked audio clip, checks `/api/readiness`, and removes the temporary
audio object. It does not invoke DeepSeek or DashScope.

Before merging a high-risk change, record the previous known-good deployment
URL from the Vercel dashboard. If the production smoke test fails and the
public journey is affected, roll back from the dashboard or run:

```bash
npx vercel rollback <previous-deployment-url-or-id> --yes
```

Do not report a release as complete until the fixed production URL and the
production smoke workflow both pass.

## Free-Tier Limits

- Vercel Hobby is for personal, non-commercial use and has no production SLA.
- Vercel Functions have finite monthly CPU and transfer allowances. The
  analyzer omits CLAP and processes no more than 60 seconds per request.
- Supabase Free can pause inactive projects and has limited database, storage,
  and egress quotas.
- DeepSeek and DashScope usage is billed separately from hosting.

After the online chain is verified, the Windows application, Cloudflare quick
tunnel, and self-hosted GitHub runner can remain stopped. The Windows deployment
workflow is retained only as a manual fallback.
