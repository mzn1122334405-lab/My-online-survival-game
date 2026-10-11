create table if not exists tribes (
  id         serial primary key,
  name       text not null unique,
  owner_id   text not null,
  created_at timestamptz not null default now()
);

create table if not exists tribe_members (
  user_id    text primary key,
  tribe_id   integer not null references tribes(id) on delete cascade,
  role       text not null default 'member',
  joined_at  timestamptz not null default now()
);
create index if not exists tribe_members_tribe_idx on tribe_members (tribe_id);
