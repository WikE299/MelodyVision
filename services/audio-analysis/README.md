# MelodyVision Audio Analysis Prototype

This service implements `V2-02`. It produces the Version 2 `MusicProfile` contract without changing the current Next.js flow.

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

The first semantic request downloads and loads `laion/clap-htsat-fused`. Later requests reuse the loaded model.

```bash
curl http://127.0.0.1:8001/health
curl -X POST http://127.0.0.1:8001/analyze \
  -F "sessionId=prototype" \
  -F "sourceKind=preset" \
  -F "file=@../../public/preset-audio/clips/bach-cello-prelude-clip.mp3"
```

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

## Prototype limits

- Analysis is capped at 60 seconds. Longer files return an `audio_truncated` warning.
- CLAP values are relative scores within controlled label groups, not objective facts.
- Successful CLAP output carries a `semantic_scores_relative` warning so downstream agents cannot silently treat hypotheses as ground truth.
- BPM values at or above 135 carry a tempo-octave warning because half-tempo may be the musically perceived pulse.
- A section is labeled `climax` only when it contains a strong local energy peak; otherwise the strongest interior change remains a `turning-point`.
- Energy, loudness, timbre, and non-tempo curves are normalized to `0-1`; `tempoCurve` retains BPM values.
- The roughness field is currently a spectral-flux proxy and carries a warning.
- V2-03 will compare these results with Meyda before this service can replace the production analyzer.
