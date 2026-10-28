create table if not exists server_progress (
  user_id text not null,
  server_id text not null,
  data text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, server_id)
);
