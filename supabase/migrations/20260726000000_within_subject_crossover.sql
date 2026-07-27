alter table public.study_trials
  add column if not exists study_session_id text,
  add column if not exists period integer,
  add column if not exists stimulus_id text not null default '';

create table if not exists public.study_assignment_blocks (
  id text primary key,
  protocol_version text not null,
  stimulus_pair_key text not null,
  sequences_json jsonb not null,
  next_position integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.study_sessions (
  id text primary key,
  participant_id text not null,
  device_session_id text not null,
  protocol_version text not null,
  sequence text not null,
  status text not null,
  current_period integer not null default 1,
  stimulus_x_id text not null,
  stimulus_y_id text not null,
  selected_musician_ids_json jsonb not null default '[]'::jsonb,
  first_trial_id text,
  second_trial_id text,
  assignment_block_id text not null,
  assignment_position integer not null,
  created_at text not null,
  updated_at text not null,
  completed_at text
);

create table if not exists public.session_comparisons (
  id text primary key,
  study_session_id text not null unique references public.study_sessions(id) on delete cascade,
  created_at text not null,
  expression_support_choice text not null,
  immersion_choice text not null,
  creative_freedom_choice text not null,
  overall_choice text not null,
  reason text not null
);

create unique index if not exists idx_study_trials_session_period
  on public.study_trials(study_session_id, period)
  where study_session_id is not null and period is not null;

create index if not exists idx_study_sessions_participant
  on public.study_sessions(participant_id, protocol_version, created_at);

create index if not exists idx_study_sessions_status
  on public.study_sessions(protocol_version, status, created_at);

create index if not exists idx_assignment_blocks_pair
  on public.study_assignment_blocks(protocol_version, stimulus_pair_key, created_at);
