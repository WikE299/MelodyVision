# MelodyVision

<p align="center">
  <img src="./app/opengraph-image.png" alt="MelodyVision crystal music-note mark" width="100%" />
</p>

<p align="center">
  <strong>An evidence-aware, conversational music-to-image co-creation system.</strong><br />
  让音乐分析、人的想象与多视角对话共同形成一幅可追溯的画面。
</p>

<p align="center">
  <a href="https://melodyvision-five.vercel.app">Public prototype</a>
  · <a href="./docs/melodyvision-research-architecture.svg">Architecture figure</a>
  · <a href="./docs/version2-study-protocol.md">Study protocol</a>
  · <a href="./docs/deployment-online.md">Deployment guide</a>
</p>

> [!NOTE]
> MelodyVision is a research prototype for studying AI-supported music visualization and human-AI co-creation. It is not a general-purpose music analysis service, and model-produced musical semantics are treated as hypotheses rather than ground truth.

## What MelodyVision does

MelodyVision turns listening into a four-step co-creation process:

1. **Choose music** from built-in examples, Jamendo search, or a local MP3, WAV, FLAC, or OGG file.
2. **Choose a listening experience** with either role-based musician perspectives or a single conversational guide.
3. **Listen and articulate an image** through four guided rounds covering subject and space, motion and composition, light and material, and personal meaning.
4. **Generate and evaluate artwork** whose prompt can be traced back to music evidence, AI perspectives, and the participant's own words.

The system also generates a music-only baseline from the same audio profile and image-model configuration. This makes it possible to compare direct generation with conversational co-creation without allowing the baseline to read the dialogue or visual brief.

## Why it is different

Many music-to-image systems collapse the whole process into one opaque prompt. MelodyVision keeps the intermediate reasoning artifacts explicit and serializable:

```text
audio
  -> MusicProfile
  -> ConversationState
  -> VisualBrief
  -> PromptDirectorInput
  -> generated artwork
```

| Contract | Responsibility |
| --- | --- |
| `MusicProfile` | Rhythm, tonality, dynamics, timbre, structure, evidence, confidence, and analyzer warnings. It does not prescribe a visual scene. |
| `ConversationState` | Selected perspectives, shared transcript, turn ownership, round limits, interruption, and generation readiness. |
| `VisualBrief` | Subject, space, composition, movement, materials, palette, lighting, atmosphere, meaning, and constraints, each with source references. |
| `PromptDirectorInput` | A validated generation package that preserves user anchors and maps visual decisions back to their sources. |

This contract-driven design supports both the user experience and research analysis: the final image is not the only artifact retained.

## Interaction conditions

The current study protocol compares two complete interaction designs:

| Condition | Experience |
| --- | --- |
| `multi_agent` | The participant selects role-based musician perspectives and encounters distinct, independently revealed interpretations. |
| `single_agent` | One visible guide supports the same four visual-articulation rounds in a continuous conversation. |

The project does **not** claim to isolate the causal effect of agent count alone. The frozen research claim, outcome measures, baseline role, and evaluation order are documented in [the V2 study protocol](./docs/version2-study-protocol.md).

## System architecture

```text
Browser
  ├─ Next.js / React interface
  ├─ local upload, preset catalog, and Jamendo search
  └─ session state and streamed NDJSON conversation
          │
          ├─ Audio analysis
          │    ├─ local: FastAPI + librosa (+ optional CLAP)
          │    └─ online: Vercel Python + librosa
          │
          ├─ Agent orchestration
          │    ├─ musician agents or single guide
          │    ├─ deterministic conversation state machine
          │    ├─ facilitator
          │    └─ Visual Scribe
          │
          ├─ Prompt Director + validation/repair
          ├─ DashScope image generation
          └─ SQLite locally / Supabase PostgreSQL and Storage online
```

The production path uploads private audio directly to Supabase through a signed URL. The analyzer processes at most the first 60 seconds and deletes the temporary audio object after analysis. LLM and image-provider credentials remain server-side.

## Technology stack

- **Application:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Audio analysis:** Python 3.12, FastAPI, librosa, NumPy, SciPy, SoundFile, optional CLAP via PyTorch and Transformers
- **Browser fallback:** Web Audio API and Meyda, available only as an explicit degraded-analysis mode
- **AI orchestration:** OpenAI-compatible Node SDK with configurable chat-model endpoint
- **Image generation:** DashScope-compatible image API, currently configured for the Wan image family
- **Persistence:** Node SQLite for local development; Supabase PostgreSQL and Storage online
- **Music discovery:** Jamendo API with license metadata and an allowlisted download path
- **Delivery:** Vercel, Supabase, GitHub Actions, with a manual Windows self-hosted fallback

## Run locally

### Prerequisites

- Node.js 24
- Python 3.12
- API credentials for the configured chat and image providers

### Setup

```bash
git clone https://github.com/WikE299/MelodyVision.git
cd MelodyVision
npm install
cp .env.example .env.local

cd services/audio-analysis
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd ../..
```

Configure at least the model credentials in `.env.local` to complete the full generation flow:

```text
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
DASHSCOPE_API_KEY=
IMAGE_MODEL=wan2.7-image
JAMENDO_CLIENT_ID=
```

Then start the Next.js application and local audio-analysis service together:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local development uses SQLite and disables CLAP by default for a predictable startup. See [the audio service guide](./services/audio-analysis/README.md) to enable semantic analysis deliberately.

## Validation

```bash
npm test
npm run lint
npm run build

cd services/audio-analysis
.venv/bin/python -m unittest discover -s tests -v
```

CI also applies every Supabase migration to a clean PostgreSQL instance. Production deployments run a real-audio smoke test against the public application without invoking paid LLM or image-generation calls.

## Repository map

```text
app/                         Next.js pages and server routes
components/                  Shared interface components
lib/agents/                  Musician, guide, facilitator, and Visual Scribe agents
lib/contracts/               MusicProfile, ConversationState, and VisualBrief
lib/conversation/            Turn protocol, state machine, streaming, and guards
lib/audio/                   Catalog, browser analysis, adapters, and remote music
lib/prompts/                 Prompt Director and generation constraints
lib/db/                      Research persistence, export, trials, and evaluations
services/audio-analysis/     FastAPI/librosa/CLAP analysis service
api/audio-profile.py         Vercel Python audio-analysis entry point
supabase/migrations/         PostgreSQL and Storage schema
tests/                       Node contract and workflow tests
docs/                        Architecture, implementation, audit, and study documents
```

## Research and data notes

- Uploaded audio is processed temporarily; structured analysis and metadata are retained, not the raw upload.
- Experiment export is disabled unless `EXPERIMENT_EXPORT_TOKEN` is configured.
- Generated artwork storage is public in the current Supabase deployment design; formal studies must disclose this clearly or change the policy.
- Three bundled recordings (`茉莉花`, `阳关三叠`, and `二泉映月`) still have unverified recording rights and should be replaced, licensed, or excluded before public/formal study use. Other catalog entries retain source and Creative Commons/public-domain attribution metadata.
- CLAP genre and instrument predictions are suppressed from factual downstream context because the current evaluation did not support treating them as verified labels.

For the current limitations and CHI-oriented release blockers, read the [V2 audit report](./docs/chi-review-audit-v2.md).

## Documentation

- [Research architecture](./docs/melodyvision-research-architecture.svg)
- [Version 2 contracts](./docs/version2-contracts.md)
- [Audio-analysis comparison](./docs/version2-audio-analysis-comparison.md)
- [Conversation orchestration](./docs/version2-conversation-orchestration.md)
- [Shared streaming conversation](./docs/version2-shared-streaming-conversation.md)
- [Visual Scribe](./docs/version2-visual-scribe.md)
- [Prompt and generation pipeline](./docs/version2-prompt-generation.md)
- [Study protocol](./docs/version2-study-protocol.md)
- [Online deployment](./docs/deployment-online.md)

## Project status

MelodyVision V2 has an end-to-end prototype, paired baseline generation, versioned research persistence, protected export, CI, and production smoke testing. The next milestone is a controlled pilot focused on comprehension, cognitive load, generation latency, manipulation checks, data governance, and image faithfulness.

No project-wide open-source license has been declared yet. Source code and bundled media should not be assumed to be reusable beyond the permissions stated for individual assets.
