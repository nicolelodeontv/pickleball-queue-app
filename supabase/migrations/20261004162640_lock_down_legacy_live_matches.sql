-- QueueZeroTwo production migration 20261004162640_lock_down_legacy_live_matches.
-- The legacy table predates this repository's migration history. Define its
-- historical shape for fresh replay, then immediately lock it down. On a
-- shared database where the table already exists, CREATE TABLE IF NOT EXISTS
-- preserves all existing rows and columns.

create table if not exists public.live_matches (
  code text primary key
    check (char_length(code) >= 4 and char_length(code) <= 10),
  court text,
  players jsonb not null default '[]'::jsonb,
  score jsonb not null default '[0, 0]'::jsonb,
  target integer not null default 11,
  status text not null default 'live',
  updated_at timestamptz not null default now()
);

alter table public.live_matches enable row level security;

drop policy if exists "anyone can add" on public.live_matches;
drop policy if exists "anyone can read" on public.live_matches;
drop policy if exists "anyone can update" on public.live_matches;

revoke all on table public.live_matches from public, anon, authenticated;
