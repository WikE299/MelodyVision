create table if not exists public.questionnaire_responses (
  id text primary key,
  response_key text not null,
  participant_id text not null,
  study_session_id text not null references public.study_sessions(id) on delete cascade,
  trial_id text references public.study_trials(id) on delete cascade,
  run_id text,
  period integer,
  condition text,
  generation_role text,
  instrument text not null,
  questionnaire_version text not null,
  scope text not null,
  status text not null,
  answers_json text not null,
  score_total double precision,
  metrics_json text not null,
  started_at text not null,
  updated_at text not null,
  completed_at text,
  unique(study_session_id, response_key)
);

create index if not exists idx_questionnaire_responses_session
  on public.questionnaire_responses(study_session_id, updated_at);

create index if not exists idx_questionnaire_responses_trial
  on public.questionnaire_responses(trial_id, updated_at);

create index if not exists idx_questionnaire_responses_participant
  on public.questionnaire_responses(participant_id, updated_at);
