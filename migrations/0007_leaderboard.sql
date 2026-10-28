create table if not exists leaderboard (
  user_id text not null,
  server_id text not null,
  username text not null,
  score integer not null default 0,
  kills integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, server_id)
);
