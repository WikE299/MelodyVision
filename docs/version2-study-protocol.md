# MelodyVision V2 Study Protocol

Status: revised for implementation on 2026-08-13. The active protocol is `v2-18-streamlined-questionnaires`. Earlier V2 records remain readable but must not be pooled with V2-18 without an explicit protocol filter.

## Research design

The formal study uses a counterbalanced within-subject crossover design. Each participant experiences both interaction conditions with different music stimuli:

- `multi_agent`: role-based, multi-perspective reflective co-creation with selected musicians.
- `single_agent`: one visible co-creation guide using the same visual-articulation objective.

The study compares the two complete interaction designs. It does not isolate or claim a causal effect from agent count alone.

After entering a participant ID, each participant chooses two different music tracks. The system counterbalances condition order and which selected track is paired with each condition. Participants do not choose a condition or bind a track to a condition themselves. Analysis must retain music identity as a covariate or random effect because the two conditions use different tracks within a participant.

Each period also has one paired `direct_baseline` artwork generated from the same `MusicProfile`. The Baseline cannot read conversation messages, musician comments, user visual input, resonance weights, or the co-created `VisualBrief`.

## Participant flow

The current formal experiment contains 17 questionnaire modules:

1. Enter participant ID and choose two different music tracks.
2. Complete the 8-item participant background questionnaire.
3. Complete period 1 and generate the co-created artwork.
4. Rate the co-created artwork with the 3-item image-alignment scale.
5. Generate the paired Baseline, then rate it with the same 3-item scale.
6. Complete period 1 CSI, agency and ownership, SUS, Raw NASA-TLX, and manipulation check.
7. Repeat steps 3-6 for period 2.
8. Complete one session preference item with an optional reason and the CSI factor-weighting task.
9. Return to the final result page, where both periods and both generation roles remain available for review.

The former six-item result-page feedback and three forced co-created/Baseline comparison questions are not part of new V2-18 sessions. They remain stored and readable only for historical protocols.

## Baseline timing

Baseline generation starts only after the participant has submitted the 3-item image-alignment scale for the current co-created artwork. The participant then waits for the paired Baseline and completes the same three ratings for it.

The server enforces this checkpoint using the completed `image_alignment` response linked to the co-created Run. A direct client request cannot bypass it. Baseline generation is idempotent per Trial and may be retried explicitly after a failure.

## Measures and scoring

- Image alignment: three matched 1-7 items, reported as their mean. It is collected separately for every co-created and Baseline artwork. These matched scores support within-condition paired comparison of the two generation roles.
- Creativity Support Index: 10 statements across enjoyment, exploration, expressiveness, immersion, and results worth effort. Collaboration items remain excluded. Factor scores are collected after each period. The factor-weighting task is completed once after both periods, then applied to both CSI responses.
- Agency and ownership: two independent 1-5 items. They are exported as separate outcomes and are not merged into a single score.
- System Usability Scale: 10 standard 1-5 items with alternating scoring transformed to 0-100.
- Raw NASA-TLX: six 0-100 dimensions and their unweighted mean.
- Manipulation check: two 1-5 process-perception items used to verify the intended condition difference, not as primary outcomes.
- Session preference: one direct overall comparison of the two experienced interaction paths plus one optional reason.

Missing values are stored as missing and never converted to zero. Current definitions and responses carry `mv-questionnaires-1.2` so future revisions can be separated during analysis.

## Persistence and export

Questionnaire responses are stored in `questionnaire_responses` and linked to participant, study session, Trial, period, condition, generation role, and image Run. The local research dashboard can:

- trace responses from participant to session, Trial, Run, and generated artwork;
- display raw answers and derived metrics in Trial details;
- export one participant per row for path-level analysis;
- export one questionnaire module per sheet in the Excel workbook;
- export one questionnaire item per row for raw-data audit and re-scoring;
- merge local and online snapshots while retaining source labels.

The workbook contains a dedicated `主体感与所有权` sheet. Trial and participant CSV exports contain separate `agency_score` and `ownership_score` columns.

The Supabase deployment must apply `supabase/migrations/20260812000000_integrated_questionnaires.sql` before formal data collection.

## Compatibility rule

- V2-15 and earlier records continue to use former result-page evaluations and comparisons.
- V2-16 and V2-17 retain their original 15-module integrated questionnaire sequence.
- V2-18 uses the streamlined 17-module sequence and does not require legacy result-page ratings or comparisons.
- Research exports identify every record by protocol and questionnaire version; missing historical fields remain missing rather than being inferred or set to zero.
