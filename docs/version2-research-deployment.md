# V2-12 Research Data and Deployment

## Outcome

Version 2 now records the whole co-creation path under one experiment session instead of retaining only the final generation and feedback.

## Persisted evidence

- experiment session creation and update time
- rich or degraded audio analysis, source kind, file name, and file size
- committed conversation state after initialization, user messages, musician turns, and generation request
- every VisualBrief version and Visual Scribe metadata
- high-value interaction events: guide selection, resonance, user input, generation, rationale inspection, download, regeneration, and restart
- generation input and output, including MusicProfile, ConversationState, VisualBrief, prompts, model metadata, image location, and timings
- end-of-flow feedback

Raw uploaded audio is excluded. The Python analyzer uses a temporary file and deletes it in `finally` after every request.

## Protected export

`GET /api/experiment/export` and `?format=csv` require `EXPERIMENT_EXPORT_TOKEN`. A missing server token returns `503`; an invalid client token returns `401`. The CSV encoder neutralizes formula-leading user text before export.

## Local research dashboard

Set `RESEARCH_DASHBOARD_ENABLED=true` only in the local development environment, then open `http://localhost:3000/research`. The page and `/api/research/data` return `404` unless the flag is enabled and the request host is `localhost`, `127.0.0.1`, or `::1`.

The dashboard reads the local database by default. To sync the protected online export automatically, add the following values to the local `.env.local` file and restart the local service:

```text
RESEARCH_REMOTE_EXPORT_URL=https://<production-project>.vercel.app/api/experiment/export
RESEARCH_REMOTE_EXPORT_TOKEN=<same value as the production EXPERIMENT_EXPORT_TOKEN>
```

When configured, `/research` automatically loads the online dataset and exposes a `同步线上数据` action. The token stays in the local Node.js process and is never sent to the browser. The most recent successful export is cached under the ignored local `data/research-cache/` directory and is used when the online export is temporarily unavailable.

If the Vercel alias cannot be reached reliably from the research machine, configure the production Supabase project directly instead:

```text
RESEARCH_SUPABASE_URL=https://<project-ref>.supabase.co
RESEARCH_SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

This direct reader is also local-only and read-only in application behavior. Keep the service-role key only in the ignored local `.env.local`; never expose it through a `NEXT_PUBLIC_` variable. When both sources are configured, the dashboard prefers the direct Supabase reader.

Manual JSON import remains available as a fallback. Imported snapshots are parsed in browser memory and never written back to the database. The default aggregate includes only the current study protocol; historical protocols remain available through the protocol filter.

Online artwork URLs point to the original Supabase Storage objects. The dashboard uses `/api/research/thumbnail` to create and cache 720p WebP previews locally; clicking a preview opens the unchanged full-resolution artwork. Supabase public object URLs are allowed by default. Add comma-separated HTTPS hostnames to `RESEARCH_IMAGE_HOSTS` only when artwork is stored elsewhere.

## Windows deployment

The GitHub Actions deployment script now manages two services:

1. `melodyvision` on port `3000`
2. `melodyvision-audio-analysis` on port `8001`

Node.js 22.13+, Python 3.12, the `py` launcher, and a server `.env.local` containing `AUDIO_ANALYSIS_URL` and `EXPERIMENT_EXPORT_TOKEN` are required. The last documented server Node 20.18 runtime must be upgraded before deployment. Dependencies are reinstalled only when `requirements.txt` changes. Both endpoints must pass health checks; otherwise the script resets to the pre-deployment commit, rebuilds it, and restarts the previous application.

The PowerShell path cannot be executed on the macOS development machine. The first Windows run must therefore be monitored through the GitHub Actions log and both server logs documented in `docs/deployment.md`.
