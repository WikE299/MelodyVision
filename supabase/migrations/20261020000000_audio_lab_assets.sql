create table if not exists public.audio_lab_assets (
  id text primary key,
  created_at text not null,
  storage_provider text not null,
  storage_path text not null,
  content_type text not null,
  bytes bigint not null,
  duration double precision,
  format text not null,
  mode text not null,
  user_direction text not null,
  visual_summary text not null,
  music_prompt text not null,
  source_run_id text not null,
  source_image_url text not null,
  source_thumbnail_url text not null,
  source_music_title text not null,
  source_role text not null,
  source_origins_json jsonb not null default '[]'::jsonb,
  visual_model text not null,
  audio_model text not null,
  provider_request_id text not null,
  provider_log_id text not null default ''
);

create index if not exists idx_audio_lab_assets_created
  on public.audio_lab_assets(created_at desc);

create index if not exists idx_audio_lab_assets_source_run
  on public.audio_lab_assets(source_run_id);

alter table public.audio_lab_assets enable row level security;

insert into storage.buckets (id, name, public)
values ('audio-lab', 'audio-lab', false)
on conflict (id) do nothing;
