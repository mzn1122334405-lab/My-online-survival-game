-- Admin moderation: permanent bans and session kicks.
alter table profiles add column if not exists banned boolean not null default false;
alter table profiles add column if not exists kicked_at timestamptz;
