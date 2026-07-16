create table if not exists public.generation_runs (
  id text primary key,
  session_id text not null,
  trial_id text not null default '',
  generation_role text not null default 'legacy',
  condition text not null default 'legacy',
  created_at text not null,
  selected_characters_json jsonb not null,
  presets_json jsonb not null,
  user_note text not null,
  music_analysis_json jsonb not null,
  music_profile_json jsonb not null default 'null'::jsonb,
  conversation_state_json jsonb not null default 'null'::jsonb,
  visual_brief_json jsonb not null default 'null'::jsonb,
  musician_comments_json jsonb not null,
  prompt_director_json jsonb not null,
  final_image_prompt text not null,
  negative_prompt text not null,
  image_url text not null,
  remote_image_url text not null,
  image_provider text not null,
  image_model text not null,
  image_size text not null default '',
  image_request_id text not null,
  timings_json jsonb not null,
  model_config_json jsonb not null default '{}'::jsonb,
  run_log_json jsonb not null default '{}'::jsonb,
  log_path text not null
);

create table if not exists public.generation_feedback (
  id text primary key,
  run_id text not null references public.generation_runs(id) on delete cascade,
  session_id text not null,
  created_at text not null,
  music_match_score integer not null,
  comment_match_score integer not null,
  aesthetic_score integer not null,
  selected_reasons_json jsonb not null,
  free_text text not null
);

create table if not exists public.experiment_sessions (
  id text primary key,
  created_at text not null,
  updated_at text not null,
  metadata_json jsonb not null
);

create table if not exists public.audio_analyses (
  id text primary key,
  trial_id text not null default '',
  session_id text not null,
  created_at text not null,
  mode text not null,
  source_kind text not null,
  file_name text not null,
  file_size integer not null,
  music_profile_json jsonb not null,
  compatibility_analysis_json jsonb not null
);

create table if not exists public.conversation_snapshots (
  id text primary key,
  trial_id text not null default '',
  session_id text not null,
  conversation_id text not null,
  created_at text not null,
  reason text not null,
  state_json jsonb not null
);

create table if not exists public.visual_brief_versions (
  id text primary key,
  trial_id text not null default '',
  brief_id text not null,
  version integer not null,
  session_id text not null,
  conversation_id text not null,
  created_at text not null,
  brief_json jsonb not null,
  meta_json jsonb not null,
  unique (brief_id, version)
);

create table if not exists public.interaction_events (
  id text primary key,
  trial_id text not null default '',
  session_id text not null,
  created_at text not null,
  event_type text not null,
  page text not null,
  payload_json jsonb not null
);

create table if not exists public.study_trials (
  id text primary key,
  participant_id text not null,
  session_id text not null,
  condition text not null,
  assignment_method text not null,
  music_profile_id text not null,
  co_created_run_id text,
  baseline_run_id text,
  comparison_order text not null,
  status text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.baseline_jobs (
  trial_id text primary key references public.study_trials(id) on delete cascade,
  status text not null,
  attempts integer not null default 0,
  run_id text,
  error text not null default '',
  started_at text,
  updated_at text not null
);

create table if not exists public.artwork_evaluations (
  id text primary key,
  trial_id text not null references public.study_trials(id) on delete cascade,
  run_id text not null,
  created_at text not null,
  music_match_score integer not null,
  imagination_match_score integer not null,
  agency_score integer not null,
  ownership_score integer not null
);

create table if not exists public.pairwise_comparisons (
  id text primary key,
  trial_id text not null unique references public.study_trials(id) on delete cascade,
  created_at text not null,
  left_role text not null,
  music_match_choice text not null,
  aesthetic_choice text not null,
  overall_choice text not null,
  reason text not null,
  revealed_at text
);

create index if not exists idx_generation_runs_session
  on public.generation_runs(session_id, created_at);
create index if not exists idx_generation_feedback_run
  on public.generation_feedback(run_id, created_at);
create index if not exists idx_audio_analyses_session
  on public.audio_analyses(session_id, created_at);
create index if not exists idx_conversation_snapshots_session
  on public.conversation_snapshots(session_id, created_at);
create index if not exists idx_visual_brief_versions_session
  on public.visual_brief_versions(session_id, created_at);
create index if not exists idx_interaction_events_session
  on public.interaction_events(session_id, created_at);
create index if not exists idx_study_trials_session
  on public.study_trials(session_id, created_at);
create index if not exists idx_study_trials_participant
  on public.study_trials(participant_id, created_at);
create index if not exists idx_artwork_evaluations_trial
  on public.artwork_evaluations(trial_id, created_at);
create unique index if not exists idx_artwork_evaluations_one_per_trial
  on public.artwork_evaluations(trial_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated',
  'generated',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public generated artwork read access'
  ) then
    create policy "Public generated artwork read access"
      on storage.objects for select
      using (bucket_id = 'generated');
  end if;
end
$$;
