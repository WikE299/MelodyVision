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

The dashboard reads the local database by default. To inspect server experiments without exposing the dashboard publicly, download the protected JSON export and drag that file into the local dashboard. Imported snapshots are parsed in browser memory and never written back to the database. The default aggregate includes only the current study protocol; historical protocols remain available through the protocol filter.

## Windows deployment

The GitHub Actions deployment script now manages two services:

1. `melodyvision` on port `3000`
2. `melodyvision-audio-analysis` on port `8001`

Node.js 22.13+, Python 3.12, the `py` launcher, and a server `.env.local` containing `AUDIO_ANALYSIS_URL` and `EXPERIMENT_EXPORT_TOKEN` are required. The last documented server Node 20.18 runtime must be upgraded before deployment. Dependencies are reinstalled only when `requirements.txt` changes. Both endpoints must pass health checks; otherwise the script resets to the pre-deployment commit, rebuilds it, and restarts the previous application.

The PowerShell path cannot be executed on the macOS development machine. The first Windows run must therefore be monitored through the GitHub Actions log and both server logs documented in `docs/deployment.md`.
