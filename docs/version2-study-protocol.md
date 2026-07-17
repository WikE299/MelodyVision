# MelodyVision V2 Study Protocol

Status: frozen for implementation on 2026-07-16. Any change to the conditions, primary outcome, round count, or measurement order must be recorded as a protocol revision before collecting formal-study data.

## Research claim

The study compares two complete interaction designs:

- `multi_agent`: role-based, multi-perspective reflective co-creation with musician selection and distinct musician viewpoints.
- `single_agent`: single-guide conversational co-creation using the same four visual-articulation rounds.

The supported claim concerns these interaction-design conditions. The study does not isolate or claim a causal effect from agent count alone.

## Research questions

Primary question: compared with single-guide conversational co-creation, how does role-based multi-perspective reflective co-creation affect the perceived alignment between the generated artwork and the participant's own music-evoked imagery?

Primary outcome: `imagination_match_score` for the co-created artwork.

Secondary outcomes:

- music-image alignment;
- perceived influence over the artwork;
- creative ownership;
- immersion in music-to-image articulation;
- satisfaction with the resulting artwork.

## Shared interaction protocol

Both conditions use the same four user-contribution goals:

1. subject and space;
2. motion and composition;
3. light, color, and material;
4. meaning and constraints.

Both conditions share the same `MusicProfile`, `VisualBrief`, generation configuration, image model, aspect ratio, retry policy, and result-evaluation order.

## Baseline role

Each trial also produces one `direct_baseline` artwork from the same `MusicProfile`. It cannot read conversation messages, musician comments, resonance weights, user visual input, or the co-created `VisualBrief`.

The participant-facing baseline comparison is labeled, not blinded. It is a secondary reflective comparison and must not be described as an unbiased blind image-quality test.

## Result and measurement order

1. Show only the co-created artwork and collect six neutral 1-5 ratings.
2. Reveal labeled controls for `co_created` and `direct_baseline`; preserve a large single-artwork canvas and let the participant switch between them.
3. Collect music-match, personal-imagery-match, overall preference, and an optional reason for the labeled comparison.
4. Collect the three manipulation checks only after the primary ratings and baseline comparison.
5. Mark the Trial complete and unlock generation rationale, download, restart, and other result controls.

## Manipulation checks

The final process check measures:

- perceived multiplicity of listening perspectives;
- support for articulating the participant's imagined scene;
- whether the interaction felt more like a shared discussion than parameter entry.

These checks validate whether the intended interaction difference was perceived. They are not primary outcome measures.

## Persistence compatibility

New trials write `labeled_comparisons` and `manipulation_checks`. `pairwise_comparisons` and `study_trials.comparison_order` remain readable for historical exports but are deprecated and are not used by the current participant flow.
