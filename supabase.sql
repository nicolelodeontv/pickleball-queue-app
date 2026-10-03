-- Run once in Supabase: SQL Editor > New query > Run
create table if not exists public.live_matches (
  code text primary key check (char_length(code) between 4 and 10),
  court text,
  players jsonb not null default '[]',
  score jsonb not null default '[0,0]',
  target int not null default 11,
  status text not null default 'live',
  updated_at timestamptz not null default now()
);
alter table public.live_matches enable row level security;
create policy "anyone can read" on public.live_matches for select using (true);
create policy "anyone can add" on public.live_matches for insert with check (true);
create policy "anyone can update" on public.live_matches for update using (true) with check (true);
alter publication supabase_realtime add table public.live_matches;
