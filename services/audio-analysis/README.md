# MelodyVision Audio Analysis Service

This service implements the Version 2 `MusicProfile` analyzer introduced in `V2-02` and connected to the application in `V2-04`.

## What it analyzes

- librosa: beat positions, BPM confidence, onset density, chroma, key hypothesis, dynamics, timbre proxies, and data-derived section boundaries.
- CLAP: relative zero-shot scores for controlled mood, genre, instrument, texture, motion, and spatial label sets.
- MelodyVision derived layer: section phases, confidence values, evidence references, and warnings.

The analyzer deliberately does not output `visualHints`. Visual interpretation belongs to the later musician conversation and Visual Scribe stages.

## Local setup

Use Python 3.12. The repository owner's default Python may be newer than the current PyTorch support window.

```bash
cd services/audio-analysis
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

On Windows, install the PyTorch build that matches the server CUDA runtime before installing the remaining requirements if the default wheel does not expose the RTX 5090.

## Run the API

```bash
cd services/audio-analysis
HF_HOME=.cache/huggingface .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

By default, startup downloads if necessary and preloads `laion/clap-htsat-fused`. Set `CLAP_PRELOAD=0` to defer loading or `CLAP_DISABLED=1` to run only the deterministic signal path.

```bash
curl http://127.0.0.1:8001/health
curl -X POST http://127.0.0.1:8001/analyze \
  -F "sessionId=prototype" \
  -F "sourceKind=preset" \
  -F "catalogItemId=bach-cello-prelude" \
  -F "file=@../../public/preset-audio/clips/bach-cello-prelude-clip.mp3"
```

## Application integration

The Next.js `/api/analyze` route proxies uploads to this service. Configure the server-only environment variable:

```text
AUDIO_ANALYSIS_URL=http://127.0.0.1:8001
```

The browser runs Meyda in parallel for realtime animation features. If this service is unavailable, the application continues with an explicitly marked `meyda-degraded` result. A successful response stores the full `MusicProfile` separately from the compatibility view used by Version 1 pages.

## Run from the command line

```bash
cd services/audio-analysis
HF_HOME=.cache/huggingface .venv/bin/python -m app.cli \
  ../../public/preset-audio/clips/bach-cello-prelude-clip.mp3 \
  --output results/bach-cello-prelude.json
```

Use `--no-semantics` to test the deterministic signal path without loading CLAP.

## Tests

```bash
cd services/audio-analysis
.venv/bin/python -m unittest discover -s tests -v
```

## V2-03 comparison

Run the production Meyda calculation against all preset clips from the repository root:

```bash
npm run audio:evaluate:meyda -- --output /tmp/v2-03-meyda.json
```

Then run the rich analyzer and generate the combined comparison from this directory:

```bash
HF_HOME=.cache/huggingface .venv/bin/python -m evaluation.compare \
  --meyda /tmp/v2-03-meyda.json \
  --output ../../docs/evaluations/version2-audio-analysis-comparison.json
```

The Node evaluation command requires Node.js 22.6 or later for type stripping. Reference labels under `evaluation/reference-labels.json` are an internal engineering aid, not publication-grade ground truth.

## Prototype limits

- Uploaded audio is written only to an operating-system temporary file and is deleted in the request `finally` block after success or failure. MelodyVision persists structured analysis and file metadata, not the raw upload.
- Analysis is capped at 60 seconds. Longer files return an `audio_truncated` warning.
- CLAP values are relative scores within controlled label groups, not objective facts.
- Successful CLAP output carries a `semantic_scores_relative` warning so downstream agents cannot silently treat hypotheses as ground truth.
- BPM values at or above 135 carry a tempo-octave warning because half-tempo may be the musically perceived pulse.
- A section is labeled `climax` only when it contains a strong local energy peak; otherwise the strongest interior change remains a `turning-point`.
- Energy, loudness, timbre, and non-tempo curves are normalized to `0-1`; `tempoCurve` retains BPM values.
- The roughness field is currently a spectral-flux proxy and carries a warning.
- V2-03 approved the signal, structure, evidence, and warning layers. CLAP genre and instrument predictions remain suppressed from downstream factual context.
