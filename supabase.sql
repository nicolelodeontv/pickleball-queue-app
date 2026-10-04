-- Run once in Supabase: SQL Editor > New query > Run
-- PickleStack uses live_matches for individual match links and live_sessions for
-- the read-only session-wide Live View.

create table if not exists public.live_matches (
  code text primary key check (char_length(code) between 4 and 10),
  court text,
  players jsonb not null default '[]',
  score jsonb not null default '[0,0]',
  target int not null default 11,
  status text not null default 'live',
  updated_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  code text primary key check (char_length(code) between 4 and 10),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.live_matches enable row level security;
alter table public.live_sessions enable row level security;

drop policy if exists "anyone can read" on public.live_matches;
drop policy if exists "anyone can add" on public.live_matches;
drop policy if exists "anyone can update" on public.live_matches;
create policy "anyone can read" on public.live_matches for select using (true);
create policy "anyone can add" on public.live_matches for insert with check (true);
create policy "anyone can update" on public.live_matches for update using (true) with check (true);

drop policy if exists "read sessions" on public.live_sessions;
drop policy if exists "insert sessions" on public.live_sessions;
drop policy if exists "update sessions" on public.live_sessions;
create policy "read sessions" on public.live_sessions for select using (true);
create policy "insert sessions" on public.live_sessions for insert with check (true);
create policy "update sessions" on public.live_sessions for update using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='live_matches'
  ) then
    execute 'alter publication supabase_realtime add table public.live_matches';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='live_sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.live_sessions';
  end if;
end $$;
