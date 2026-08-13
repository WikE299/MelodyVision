alter table public.study_sessions
  add column if not exists stimulus_x_json jsonb,
  add column if not exists stimulus_y_json jsonb;
