alter table public.study_trials
  add column if not exists protocol_version text not null default 'v2-13-blind-comparison';

alter table public.artwork_evaluations
  add column if not exists immersion_score integer,
  add column if not exists satisfaction_score integer;

create table if not exists public.labeled_comparisons (
  id text primary key,
  trial_id text not null unique references public.study_trials(id) on delete cascade,
  created_at text not null,
  music_match_choice text not null,
  imagination_match_choice text not null,
  overall_choice text not null,
  reason text not null
);

create table if not exists public.manipulation_checks (
  id text primary key,
  trial_id text not null unique references public.study_trials(id) on delete cascade,
  created_at text not null,
  perspective_multiplicity_score integer not null,
  articulation_support_score integer not null,
  dialogue_experience_score integer not null
);

create index if not exists idx_labeled_comparisons_trial
  on public.labeled_comparisons(trial_id, created_at);

create index if not exists idx_manipulation_checks_trial
  on public.manipulation_checks(trial_id, created_at);
