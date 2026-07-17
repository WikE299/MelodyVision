insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-analysis',
  'audio-analysis',
  false,
  20971520,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/ogg',
    'application/ogg',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
