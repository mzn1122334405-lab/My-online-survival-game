-- Island profiles, admin flags, and public chat (signed-in players only).
create table if not exists profiles (
  user_id    text primary key,
  username   text not null unique,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profiles_username_idx on profiles (lower(username));

create table if not exists chat_messages (
  id         serial primary key,
  user_id    text not null,
  username   text not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_idx on chat_messages (created_at desc);
