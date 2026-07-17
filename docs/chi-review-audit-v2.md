# MelodyVision V2 CHI-style Audit Report

Audit date: 2026-07-15

Protocol update: on 2026-07-16 the participant-facing randomized blind comparison described in this audit was replaced by a labeled co-created/direct-baseline comparison followed by manipulation checks. The frozen current protocol is documented in `docs/version2-study-protocol.md`; references to blind A/B below describe the audited historical build.

## Executive verdict

The current V2 prototype is technically suitable for a controlled pilot study on a desktop computer. The two interactive conditions, paired direct baseline, four-round co-creation protocol, evidence-preserving Prompt Director, two-stage evaluation, and research export are all present in one end-to-end system.

It is not yet submission-ready as a CHI study artifact. The main remaining blockers are not page styling or ordinary code errors. They are research ethics and data governance, three unverified preset recordings, validation of the deployed semantic audio model, and careful wording of the causal claim. These must be resolved before a public study or a paper submission.

## Audit scope and evidence

The audit covered:

- Home audio entry: preset, Jamendo search, MP3/WAV/FLAC/OGG upload, and study-mode assignment.
- Audio pipeline: browser or remote upload, Python analysis, MusicProfile persistence, and compatibility mapping.
- Condition A: musician selection, four independently revealed comments, four guided user inputs, and VisualBrief updates.
- Condition B: one visible co-creation guide, four matched rounds, and the same VisualBrief contract.
- Paired direct baseline: same MusicProfile and model configuration, with conversation evidence excluded.
- Prompt Director: evidence IDs, comment weights, validation, repair loop, negative prompt, and image persistence.
- Results: single-artwork evaluation, randomized blind A/B comparison, reveal, artwork switching, audio playback, and research appendix.
- Deployment: local SQLite, Supabase adapter and migration, Vercel path, Hugging Face audio service, Windows fallback, secret handling, and generated-image storage.
- Browser layout: 1280 x 720 and desktop-wide behavior, element bounds, overlap, scroll, language toggle, and browser console.

Observed real run:

- Audio: preset piano arrangement of `茉莉花`.
- Rich analysis: `MusicProfile 2.0.0` produced successfully.
- Condition: Path A with 伯牙, 贝多芬, 阿炳, and 阿姆斯特朗.
- Interaction: four comments and four concrete user contributions.
- Output: 1696 x 960 image using `wan2.7-image`.
- Result: glass greenhouse, white jasmine, deep blue night, warm gold side light, spiral petals, cracked wood, and water ripples were visibly retained.

## Issues fixed during this audit

1. Prompt evidence IDs used two incompatible namespaces. The validator expected VisualBrief wrapper IDs while the model correctly returned original user-message IDs. This forced a repair and then a deterministic fallback on every rich co-created run. The contract now deduplicates and validates the authoritative `sourceId`.

2. The repaired generation now uses the Prompt Director output instead of a diluted bilingual fallback. A representative run dropped from about 36 seconds to about 22 seconds when the first model output passed validation.

3. Prompt weighting explanations copied the JSON example value `1.8` instead of the actual input weight. Every comment must now appear exactly once and preserve its numeric weight.

4. Direct baseline generation now receives the same compact MusicProfile as co-created generation, while still rejecting conversation, comments, resonance, VisualBrief, and prompt overrides.

5. Formal balanced assignment is serialized in SQLite and protected by a PostgreSQL transaction advisory lock in Supabase.

6. Formal study trials can no longer use the two-round early-generation shortcut. Both conditions must complete four user rounds. The shortcut remains available only in the multi-agent demo path.

7. Formal study mode no longer briefly flashes the A/B path chooser before the URL mode is resolved.

8. The four Path A comment cards now stay visible together and no transparent overlay intercepts the next musician click.

9. Jamendo search and download failures now return bounded, readable errors instead of unhandled network exceptions. Search, direct download, and the actual remote-analysis path were each tested successfully.

10. Preset full-track playback now uses a range-capable server route. A local/server deployment plays the original file when present; a GitHub/Vercel build falls back to the committed 45-second clip instead of returning 404.

11. At 1280 x 720 all eight preset cards fit in one viewport. The home, musician selection, listening, single-artwork evaluation, and blind comparison layouts have no measured overlap or document overflow.

## CHI strengths

### Traceable co-creation

The live chain is explicit:

`MusicProfile -> ConversationState -> VisualBrief -> PromptDirectorInput -> generated image`

Each VisualBrief field stores provenance, status, and source IDs. The Prompt Director must preserve user evidence, every visible contributor, constraints, and weights. This is stronger than relying on a single opaque prompt string.

### Paired baseline design

Each participant produces one co-created artwork and one music-only baseline from the same MusicProfile, model, image dimensions, and generation policy. The baseline is generated before the result comparison and cannot read dialogue data. This supports a useful within-participant comparison while the interactive condition remains between participants.

### Bias-aware result flow

The participant first rates only the co-created artwork. The baseline is then introduced as randomized Artwork A/B, with provenance hidden until the comparison is submitted. Refreshing preserves comparison order.

### Honest audio uncertainty

Tempo octave ambiguity, truncation, semantic-model availability, and proxy descriptors are represented as warnings instead of being silently promoted to musical facts.

## P0 before a formal or public user study

### 1. Consent, withdrawal, and data governance

There is no participant-facing consent screen, study information sheet, withdrawal code, retention period, deletion flow, or privacy statement. Conversation text, audio metadata, model prompts, images, timing, and ratings can all be research data. Before formal recruitment, define:

- what is collected and why;
- whether uploaded audio is retained;
- how a participant can withdraw after leaving;
- retention and deletion periods;
- who can access exports;
- whether generated images are public;
- the ethics/IRB approval reference where applicable.

The Supabase `generated` bucket is currently public by design. Do not treat it as private participant storage.

### 2. Preset recording rights

Five presets have a documented CC or public-domain source. Three remain `needs-review`: `茉莉花`, `阳关三叠`, and `二泉映月`. A traditional composition or old performance does not automatically clear a specific MP3 recording. Replace these three recordings, obtain permission, or exclude them from public/formal deployments.

The original full-length files are intentionally not committed to Git. Public deployment therefore falls back to the 45-second clips until legally distributable full tracks are hosted.

### 3. Validate the deployed semantic audio model

The local deterministic development service currently reports CLAP as disabled. Rhythm, tonality, dynamics, timbre, and section descriptors run, but high-level mood/genre/instrument semantics do not. The Hugging Face Docker image enables CLAP, but a live deployed evaluation set is still required.

Do not claim that V2 “understands emotion, genre, or instrumentation” until precision/recall or human agreement is reported on representative study audio. At minimum, record model version, model-loaded state, warning codes, audio hash, analyzed interval, and cold-start behavior for every trial.

### 4. Frame the causal claim correctly

Path A and Path B differ in more than agent count. Path A includes musician selection, named historical perspectives, independent comment reveal, and a reflective journal layout. Path B uses one visible guide and a conversational layout. Therefore the supported claim is about two interaction-design conditions, not the isolated causal effect of “multi-agent versus single-agent.”

If the paper needs a pure agent-count claim, equalize visible identities, musician choice, turn timing, text volume, and layout. Otherwise describe the treatment as “role-based multi-perspective reflective co-creation” versus “single-guide conversational co-creation.”

## P1 before a larger pilot

### Generation latency

The image model itself took about 3 seconds in the audited run. The Prompt Director took 15-19 seconds, and one repair added about 11 seconds. Typical successful end-to-end generation was 22-30 seconds. The current staged progress UI is useful, but future work should:

- reduce duplicated prompt evidence;
- cache immutable music summaries;
- measure p50/p95 by stage;
- keep the repair loop, but improve first-pass schema compliance;
- display real server stages rather than estimated percentages where possible.

### Background baseline execution

The baseline uses an idempotent database lease, but the browser still initiates the work. A closed tab, serverless timeout, or sleeping service can delay it until recovery. For a larger study, move baseline generation to a durable job queue or scheduled worker.

### Trial ownership and abuse controls

Trial, evaluation, conversation, event, and generation endpoints trust client-supplied IDs. Export is token-protected, but individual trial reads and writes have no signed session ownership. Before an open deployment, add a signed study-session cookie or per-trial capability token, request limits, and payload limits for all research endpoints.

### Refresh recovery

Most structured state is durable, but locally uploaded audio playback depends on a browser object URL and cannot survive a full browser restart. Persist the original audio only with explicit consent, or clearly tell the participant that refresh recovery restores the study state but not private audio playback.

### External-service reliability

Jamendo, Hugging Face Free Spaces, DeepSeek, DashScope, Supabase Free, and Vercel Hobby have no shared uptime guarantee. Search and remote download can take several seconds, and a sleeping audio Space can take minutes to wake. Add pre-session readiness checks, operator alerts, a warm-up protocol, and a study-day fallback plan.

### Image-policy constraint

The current Prompt Director globally forbids people and visible text. This improves image reliability, but it also overrides a participant who explicitly imagines a person. Either explain this creative boundary to participants or convert it into a study-visible constraint. Otherwise agency scores may partly measure an undisclosed system restriction.

### Live Supabase staging test

The local SQLite path and schema tests pass. The PostgreSQL adapter, migration, public storage policy, image upload, experiment export, and advisory lock still require one clean staging deployment test against an empty Supabase project before participant use.

### Dependency advisory

`npm audit --omit=dev` reports two moderate findings caused by Next's bundled PostCSS version (`GHSA-qx2v-qp2m-jg93`). The suggested npm fix is an invalid downgrade to Next 9 and must not be applied. Track the next compatible Next release and avoid rendering untrusted CSS in the meantime.

## P2 quality improvements

- Split `app/listen/page.tsx`, `app/result/page.tsx`, `app/api/generate/route.ts`, and `components/HomePageClient.tsx` into testable feature modules. Their size now raises regression risk.
- Add automated browser tests for the exact 1280 x 720 study viewport, both languages, one/three/four musicians, baseline recovery, and refresh recovery.
- Add `aria-live` for the most important streaming turn changes and verify the full flow with keyboard-only navigation and a screen reader.
- Retain `prefers-reduced-motion` support and expose a persistent motion control for participants sensitive to pulsing cues or moving result-page echoes.
- Remove the obsolete tracked `public/preset-audio/music2image.mp3` after confirming no historical deployment depends on it.
- Add quantitative image-faithfulness coding for required user anchors, prohibited elements, musician contributions, and audio-derived motion/texture. A visually attractive result is not sufficient evidence of faithful co-creation.

## UX observations by step

### Step 1: music entry

The neutral three-entry design and progressive disclosure work well. Upload remains visually equal to presets and search. Study mode correctly hides the A/B choice and assigns a condition server-side. Remaining risk is waiting time for a cold remote analyzer; readiness should be checked before the participant begins.

### Step 2: guide selection

Ten musicians fit in one desktop viewport, selection is understandable, and Path B skips this treatment-specific page. The musician cards communicate identity mainly through name and portrait; future study materials should explain that these are AI interpretations rather than authentic endorsements by the represented people.

### Step 3: listening and co-creation

This is now the experiential center of the product. Path A offers distinct musician perspectives and preserves four comments; Path B feels like a continuous guided chat. The four-round dimensions provide useful scaffolding: subject/space, motion/composition, light/material, meaning/constraints.

The strongest remaining UX question is not visual polish but cognitive load. Long musician comments may be difficult to read while listening. Log reading time, replay/close actions, and user response latency, then shorten or progressively reveal comments based on pilot data.

### Step 4: result and evaluation

The artwork is visually dominant before evaluation. The blind comparison does not overlap the images, randomizes order, and delays provenance reveal. The post-reveal artwork switch is useful for reflection. The moving conversation recap is separated from the artwork and pauses on hover; reduced-motion CSS is present.

## Image-generation assessment

The corrected Prompt Director produced a much stronger mapping than the previous fallback. In the audited run:

- User anchors retained: glass greenhouse, white jasmine, deep blue night, gold side light.
- Motion retained: petals moving outward and water ripples.
- Material retained: glass, translucent petals, cracked wood.
- Musician-derived detail retained: water surface, restrained glow, old wood, and fine luminous particles.
- Constraints retained: no visible people, text, or traditional ink landscape.

The main weakness is that a single image cannot make every source equally salient. “Presence in the prompt” should not be treated as “visible in the image.” Store both source-to-prompt and source-to-image evaluations, and distinguish hard user anchors from optional supporting details.

## Verification matrix

Passed in the audited local environment:

- ESLint: no errors.
- TypeScript: no errors.
- Node tests: 39 passed.
- Python audio/security tests: 8 passed.
- Rich preset analysis: passed.
- Jamendo search: passed with 10 results in the sampled query.
- Jamendo direct download then rich analysis: passed.
- Actual homepage remote Jamendo analysis path: passed after a fresh service start.
- Prompt Director first-pass validation: passed after source-ID repair.
- Prompt Director repair loop: passed when a positive prompt contained forbidden terms.
- Image generation and local persistence: passed at 1696 x 960.
- Single-artwork evaluation and blind A/B comparison: passed.
- Preset audio range playback: MP3 and OGG passed with HTTP 206.
- 1280 x 720 browser overflow and overlap checks: passed for audited pages.
- Browser console: no application errors in the final pass.

Production build and final Git cleanliness are verified as release gates immediately before the associated commit.

## Recommended next order

1. Replace or disable the three uncleared recordings.
2. Add consent, withdrawal, retention, and private-storage decisions.
3. Deploy a clean Supabase + Hugging Face + Vercel staging environment and run one complete trial.
4. Build a small labeled audio benchmark and report deployed analyzer quality.
5. Freeze the experimental protocol and causal wording before further UI changes.
6. Run a 5-8 participant pilot focused on comprehension, reading load, latency, and manipulation checks.
7. Only then begin the formal study.

## Reliability boundary

The repository can be made free of reproducible lint, test, type, build, route, and browser-layout errors. No application can guarantee that third-party APIs, free hosting tiers, participant networks, or stochastic models will never fail. For a study, reliability therefore requires both validated code and an operational fallback protocol.
