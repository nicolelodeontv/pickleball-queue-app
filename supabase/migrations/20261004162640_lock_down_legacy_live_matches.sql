-- QueueZeroTwo production migration 20261004162640_lock_down_legacy_live_matches.
-- The production migration locked down the legacy table. Fresh isolated replay
-- does not create that pre-migration table, so skip only when it is absent.
do $$
begin
  if to_regclass('public.live_matches') is not null then
    alter table public.live_matches enable row level security;

    drop policy if exists "anyone can add" on public.live_matches;
    drop policy if exists "anyone can read" on public.live_matches;
    drop policy if exists "anyone can update" on public.live_matches;

    revoke all on table public.live_matches from public, anon, authenticated;
  end if;
end
$$;
