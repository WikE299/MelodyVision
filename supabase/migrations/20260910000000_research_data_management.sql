create table if not exists public.research_data_annotations (
  entity_type text not null,
  entity_id text not null,
  classification text not null default 'unclassified',
  cohort_label text not null default '',
  protected integer not null default 0,
  excluded_from_analysis integer not null default 0,
  trashed_at text,
  note text not null default '',
  updated_at text not null,
  primary key (entity_type, entity_id),
  constraint research_data_annotations_entity_type_check
    check (entity_type in ('study_session', 'trial', 'generation_run')),
  constraint research_data_annotations_classification_check
    check (classification in ('unclassified', 'formal', 'pilot', 'test', 'excluded'))
);

create table if not exists public.research_admin_actions (
  id text primary key,
  action text not null,
  target_type text not null,
  target_ids_json jsonb not null,
  source text not null,
  affected_counts_json jsonb not null,
  backup_ref text not null default '',
  created_at text not null
);

create index if not exists idx_research_annotations_classification
  on public.research_data_annotations(classification, trashed_at, updated_at);

create index if not exists idx_research_admin_actions_created
  on public.research_admin_actions(created_at);

create or replace function public.research_purge_records(p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected jsonb := '{}'::jsonb;
  changed integer;
begin
  delete from public.generation_feedback
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'generation_feedback', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('generation_feedback', changed);

  delete from public.questionnaire_responses
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'questionnaire_responses', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('questionnaire_responses', changed);

  delete from public.session_comparisons
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'session_comparisons', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('session_comparisons', changed);

  delete from public.artwork_evaluations
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'artwork_evaluations', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('artwork_evaluations', changed);

  delete from public.pairwise_comparisons
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'pairwise_comparisons', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('pairwise_comparisons', changed);

  delete from public.labeled_comparisons
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'labeled_comparisons', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('labeled_comparisons', changed);

  delete from public.manipulation_checks
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'manipulation_checks', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('manipulation_checks', changed);

  delete from public.baseline_jobs
  where trial_id in (select jsonb_array_elements_text(coalesce(p_plan -> 'baseline_jobs', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('baseline_jobs', changed);

  delete from public.audio_analyses
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'audio_analyses', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('audio_analyses', changed);

  delete from public.conversation_snapshots
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'conversation_snapshots', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('conversation_snapshots', changed);

  delete from public.visual_brief_versions
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'visual_brief_versions', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('visual_brief_versions', changed);

  delete from public.interaction_events
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'interaction_events', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('interaction_events', changed);

  delete from public.generation_runs
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'generation_runs', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('generation_runs', changed);

  delete from public.study_trials
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'study_trials', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('study_trials', changed);

  delete from public.study_sessions
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'study_sessions', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('study_sessions', changed);

  delete from public.experiment_sessions
  where id in (select jsonb_array_elements_text(coalesce(p_plan -> 'experiment_sessions', '[]'::jsonb)));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('experiment_sessions', changed);

  delete from public.research_data_annotations
  where (entity_type = 'study_session' and entity_id in (select jsonb_array_elements_text(coalesce(p_plan -> 'annotation_study_session_ids', '[]'::jsonb))))
     or (entity_type = 'trial' and entity_id in (select jsonb_array_elements_text(coalesce(p_plan -> 'annotation_trial_ids', '[]'::jsonb))))
     or (entity_type = 'generation_run' and entity_id in (select jsonb_array_elements_text(coalesce(p_plan -> 'annotation_generation_run_ids', '[]'::jsonb))));
  get diagnostics changed = row_count;
  affected := affected || jsonb_build_object('research_data_annotations', changed);

  return affected;
end;
$$;

revoke all on function public.research_purge_records(jsonb) from public, anon, authenticated;
grant execute on function public.research_purge_records(jsonb) to service_role;
