# MelodyVision Development, CI, and Release Workflow

## Purpose

This document is an implementation brief for upgrading MelodyVision's current
development and deployment process into a repeatable, verifiable workflow.

The intended outcome is:

```text
User task
-> Agent verifies the problem and defines acceptance criteria
-> Independent branch and, when needed, independent worktree
-> Scoped implementation
-> Local automated tests and UI verification
-> Push branch and create PR
-> CI validation
-> Vercel Preview validation
-> Merge to main
-> Production deployment
-> Real production smoke test
-> Documentation and Agent knowledge reconciliation
-> Final report
-> User confirmation
-> Branch, worktree, and temporary-data cleanup
```

This process must remain practical for a single-developer research prototype.
It should improve reliability without turning every small documentation change
into a heavyweight release.

## Implementation Status

As of 2026-07-18, the repository implements the first release gate and the
server-side part of production verification:

- `.github/workflows/ci.yml` runs Node, Python audio, and migration validation
  for pull requests and pushes to `main`.
- `.github/pull_request_template.md` records the task contract, verification,
  Preview review, release risk, and documentation impact.
- `.github/workflows/smoke-online-deployment.yml` remains manually runnable and
  also listens for a successful Vercel `Production` deployment status.
- GitHub protects `main`, requires pull requests, and requires the three CI
  checks listed below. The rule also applies to repository administrators.
- The Windows deployment remains a manual fallback.

The following work is intentionally still pending:

- Preview data isolation from the production Supabase project.
- Browser-level end-to-end coverage.
- Automated paid-model full-chain testing. This remains a controlled manual
  release check.

## Current Baseline

The repository already has:

- Node tests through `npm test`.
- ESLint through `npm run lint`.
- Next.js production build through `npm run build`.
- Python audio-analysis tests under `services/audio-analysis/tests`.
- A manually triggered online smoke test:
  `.github/workflows/smoke-online-deployment.yml`.
- A manually triggered Windows fallback deployment:
  `.github/workflows/deploy-windows-server.yml`.
- Vercel production deployment from the GitHub `main` branch.
- Supabase storage and PostgreSQL production persistence.
- A real smoke-test path that uploads an audio clip, analyzes it, checks the
  returned profile, checks `/api/readiness`, and removes temporary audio.

Remaining gaps:

1. Vercel Preview review is not yet backed by isolated Preview data.
2. There is no browser-level end-to-end test suite.
3. Paid-model full-chain testing is manual by design.
4. Branch, worktree, temporary database, and storage cleanup are documented but
   not fully automated.

## Core Rules

### Branch and workspace isolation

- Every code change must use a task branch named `codex/<task-slug>`.
- Use an independent worktree when:
  - the current workspace has uncommitted changes;
  - another task is being developed in parallel;
  - a long-running server or test process is needed;
  - an urgent production fix must not disturb current work.
- A small documentation-only change may use a branch without a separate
  worktree when the current workspace is clean.
- Never overwrite, reset, or discard unrelated user changes.

### Acceptance before implementation

Before editing code, record:

- Problem statement.
- Expected user-visible result.
- Non-goals.
- Affected routes, contracts, models, database tables, and pages.
- Local test requirements.
- Preview and production verification requirements.
- Whether the test invokes paid DeepSeek or DashScope APIs.

### Merge policy

CI passing is necessary but is not sufficient for every change.

Require human Preview review before merging changes that affect:

- User-facing page behavior or visual layout.
- Musician comments or conversation behavior.
- Prompt Director rules.
- Model selection or model parameters.
- Audio-analysis interpretation.
- Database schema or research-data semantics.

Documentation, tests, and low-risk internal fixes may be merged after required
checks pass. Do not enable unconditional auto-merge for all PRs.

## Target Workflow

### 1. Task intake

Create a short task contract:

```text
Goal:
Observed problem:
Acceptance criteria:
Non-goals:
Risk level:
Affected areas:
Required tests:
Production verification:
```

Classify the task:

- `low`: documentation, tests, copy, or isolated internal cleanup.
- `medium`: normal feature or bug fix without migration/model behavior changes.
- `high`: database migration, model change, Prompt Director change, audio
  pipeline change, authentication, storage, or core user journey.

### 2. Development

Create a task branch and use a worktree when the isolation rules require it.
Keep the diff scoped to the task. Add or update tests that reproduce the
requested behavior.

### 3. Local validation

Always run:

```bash
npm test
npm run lint
npm run build
```

Run additional checks according to the change:

| Change area | Additional checks |
| --- | --- |
| Python audio analysis | Python unittest suite and a real sample clip |
| Audio upload/storage | Upload, analyze, cleanup, and file-size validation |
| UI interaction | Browser test on desktop and mobile viewports |
| Prompt Director | Contract, validator, repair, and fallback tests |
| Musician Agents | Agent contract and conversation-state tests |
| Database migration | Apply migrations to an ephemeral PostgreSQL database |
| Research logging | Verify rows, JSON fields, export, and cleanup |
| Model integration | Mocked contract test by default; one controlled real call for release |

Paid image-generation calls must not run on every PR. Use mocked contract tests
in CI. Run one real end-to-end generation manually for major releases or model
changes.

### 4. Pull request

The PR must include:

- Problem and solution summary.
- Files and contracts changed.
- Local verification results.
- Preview URL when available.
- Screenshots for visible UI changes.
- Database migration and rollback notes when applicable.
- Remaining risks or untested behavior.

The branch must be pushed before creating the PR. The PR must target `main`.

### 5. PR CI

Add `.github/workflows/ci.yml` with:

```yaml
on:
  pull_request:
  push:
    branches:
      - main
```

Required CI jobs:

1. Node validation:
   - checkout;
   - install the repository's supported Node version;
   - `npm ci`;
   - `npm test`;
   - `npm run lint`;
   - `npm run build`.
2. Python audio validation:
   - install the supported Python version;
   - install `services/audio-analysis` test dependencies;
   - run `python -m unittest discover -s tests -v`.
3. Migration validation:
   - start an ephemeral PostgreSQL service;
   - apply all Supabase migrations in order;
   - fail on migration errors.

Use concurrency cancellation for superseded commits on the same PR. Upload
useful logs or screenshots as artifacts when a job fails.

Configure GitHub branch protection for `main`:

- Pull requests required.
- Required checks:
  - `Node validation`
  - `Python audio validation`
  - `Migration validation`
- Direct pushes disabled.
- Stale approvals dismissed after relevant new commits when human review is
  required.

Apply branch protection only after the three checks have completed once, so
GitHub can resolve the check names.

### 6. Vercel Preview

Use the Vercel GitHub integration to create a Preview deployment for each PR.

Preview verification must not write uncontrolled test data into the production
database. Use one of:

- a dedicated preview Supabase project;
- an isolated test schema and explicit test-data prefix;
- read-only or mocked integrations for Preview checks.

At minimum, Preview validation should cover:

- Homepage loads.
- Audio entry options render.
- A known audio clip can enter the analysis flow.
- Result pages render without browser console errors.
- `/api/readiness` exposes no secret values.

High-risk or user-facing PRs must be reviewed on the Preview URL before merge.

### 7. Production deployment

Merging to `main` triggers the Vercel production deployment.

The Windows RTX 5090 deployment remains a manually triggered fallback unless a
separate decision changes the production architecture.

Record before deployment:

- Merge commit SHA.
- Previous known-good production deployment.
- Migration requirements.
- Expected readiness provider and schema version.

### 8. Production smoke test

Extend `.github/workflows/smoke-online-deployment.yml` so it can run:

- manually with `workflow_dispatch`;
- automatically after a successful production deployment.

The production smoke test must:

1. Request the audio-analysis health endpoint.
2. Request an upload ticket.
3. Upload a fixed short audio clip.
4. Analyze the uploaded clip.
5. Validate the expected schema version and required analyzer output.
6. Request `/api/readiness`.
7. Delete temporary uploaded audio in a guaranteed cleanup step.
8. Report the tested production URL and commit SHA.

The smoke test should not require a paid image-generation call on every
deployment.

For major releases, manually run one controlled full-chain test:

```text
audio
-> analysis
-> musician comments
-> user note
-> Prompt Director
-> image generation
-> Supabase persistence
-> result-page playback and image display
```

If the production smoke test fails:

- Do not report the task as complete.
- Preserve logs and the failing commit SHA.
- Diagnose whether the failure is application, database, storage, model, or
  deployment related.
- Roll back to the previous known-good Vercel deployment when the failure
  affects the public user journey.

## Documentation and Knowledge Reconciliation

The project can borrow the principles from the external
[`neat-freak` skill](https://github.com/KKKKhazix/khazix-skills/blob/main/neat-freak/SKILL.md),
but must not copy its platform assumptions blindly.

MelodyVision's knowledge layers are:

| Layer | Purpose |
| --- | --- |
| `AGENTS.md` | Mandatory coding rules and non-obvious engineering constraints |
| `CLAUDE.md` | Pointer to the canonical project Agent rules |
| `docs/` and `README.md` | Current architecture, contracts, deployment, study, and operations |
| Agent memory | Stable, reusable lessons not obvious from current code or documentation |
| Git history and PRs | Implementation history and one-time incident details |

Rules:

- Keep `AGENTS.md` as the current canonical project rule file.
- Do not reverse the existing `CLAUDE.md -> AGENTS.md` relationship merely to
  match another project's convention.
- Do not put release history or one-time bug narratives in `AGENTS.md`.
- Update existing documentation in place instead of repeatedly appending
  duplicate sections.
- New API routes must update relevant contract and architecture documentation.
- New environment variables must update deployment and operations documentation.
- New database tables or fields must update schema and research-data
  documentation.
- Retired routes, variables, and fields must be removed from active
  documentation.
- Only write Agent memory after the change is merged and verified in production.
- Agent memory updates must use the mechanism permitted by the active Codex
  environment; do not directly rewrite generated memory indexes.

Run a scoped reconciliation after each meaningful task:

1. Inspect only documentation affected by the change.
2. Compare documentation claims with the merged code.
3. Update stale operational commands, routes, environment variables, or
   contracts.
4. Record only stable and reusable lessons in Agent memory.

Run a full documentation and rule audit at a milestone or scheduled interval,
not after every trivial edit.

## Final Report Contract

The Agent's final report must include:

```text
Task:
PR:
Merge commit:
Production URL:
CI result:
Preview verification:
Production smoke result:
Full-chain test result, if required:
Database migration:
Documentation updated:
Agent memory updated:
Remaining risks:
User action required:
```

Do not say "deployed successfully" unless the production URL and required smoke
checks were actually verified.

## Confirmation and Cleanup

Wait for user confirmation before deleting recoverable development context for
a high-risk or user-facing task.

After confirmation:

- Remove the local worktree.
- Delete the local task branch.
- Delete the remote task branch when the PR is merged and no rollback work is
  expected.
- Remove temporary databases or schemas created for the task.
- Remove CI-prefixed test rows and temporary storage objects.
- Stop task-specific development servers.
- Keep PR discussion, CI artifacts needed for debugging, production logs, and
  research records required by the study.

Temporary data cleanup should also be protected by `finally`/`always()` steps or
a TTL. User confirmation must not be the only cleanup mechanism for uploaded
audio and test database rows.

## Implementation Order

### Phase 1: Required PR gate

Implement first:

1. `.github/workflows/ci.yml`.
2. Node, Python, and migration CI jobs.
3. `.github/pull_request_template.md`.
4. Document the required `main` branch-protection settings.

Acceptance:

- A deliberately failing Node test blocks the PR.
- A lint error blocks the PR.
- A Next.js build failure blocks the PR.
- A Python audio test failure blocks the PR.
- A broken migration blocks the PR.
- A successful change produces all green required checks.

Implemented by:

- `.github/workflows/ci.yml`
- `.github/pull_request_template.md`

### Phase 2: Preview and production verification

Implement after Phase 1:

1. Formalize Vercel Preview review.
2. Add browser smoke coverage.
3. Trigger the existing online smoke test after production deployment.
4. Include deployment URL and commit SHA in the result.
5. Add rollback instructions to `docs/deployment-online.md`.

Acceptance:

- Every PR receives a Preview URL.
- High-risk PRs cannot be considered accepted without Preview review.
- A production deployment automatically runs the real audio smoke test.
- Failed production smoke is visible and does not produce a success report.

Partially implemented:

- Vercel Git deployment status can trigger the existing real-audio smoke test.
- The workflow summary records the tested URL and deployment commit.

Still required:

- Isolated Preview data.
- Browser smoke coverage.
- Observed verification that the Vercel Git integration emits the production
  deployment status for this repository.

### Phase 3: Release hygiene

Implement last:

1. Add the scoped documentation-impact checklist to the PR template.
2. Add a release-report template.
3. Formalize worktree and test-data cleanup.
4. Create a MelodyVision-specific knowledge-reconciliation routine based on the
   principles in `neat-freak`.

Acceptance:

- Changed routes, environment variables, schemas, and operational commands are
  reflected in documentation.
- Agent rules do not become a changelog.
- Agent memory contains reusable lessons rather than release narration.
- Cleanup never removes unrelated user work or required research records.

## Constraints for the Implementing Agent

- Preserve unrelated uncommitted changes in the current workspace.
- Do not deploy unfinished work from a dirty working tree.
- Do not add paid API calls to required PR CI.
- Do not expose production secrets to pull requests or browser code.
- Do not let Preview deployments mutate production research data without an
  explicit isolation mechanism.
- Do not remove the Windows workflow; keep it as a manual fallback.
- Do not change application behavior while implementing Phase 1 unless required
  to make existing tests deterministic.
- Implement and verify one phase at a time.
