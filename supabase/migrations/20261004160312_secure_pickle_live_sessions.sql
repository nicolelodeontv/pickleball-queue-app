-- QueueZeroTwo production migration 20261004160312_secure_pickle_live_sessions.
-- Reconstructed from the statements stored in the shared project's migration ledger.
alter table public.live_sessions
  add column if not exists host_key text,
  add column if not exists expires_at timestamptz;

update public.live_sessions
set
  host_key = encode(extensions.digest('legacy-' || code || '-' || updated_at::text, 'sha256'), 'hex'),
  expires_at = coalesce(expires_at, updated_at + interval '7 days')
where host_key is null;

alter table public.live_sessions
  alter column host_key set not null,
  alter column expires_at set default (now() + interval '7 days');

alter table public.live_sessions
  drop constraint if exists live_sessions_host_key_check,
  drop constraint if exists live_sessions_payload_size_check;

alter table public.live_sessions
  add constraint live_sessions_host_key_check
    check (host_key ~ '^[0-9a-f]{64}$'),
  add constraint live_sessions_payload_size_check
    check (octet_length(data::text) <= 200000);

drop policy if exists "insert sessions" on public.live_sessions;
drop policy if exists "read sessions" on public.live_sessions;
drop policy if exists "update sessions" on public.live_sessions;
drop policy if exists "PickleStack live exact-code read" on public.live_sessions;

alter table public.live_sessions enable row level security;

revoke all on table public.live_sessions from anon, authenticated;
grant select on table public.live_sessions to anon, authenticated;

create policy "PickleStack live exact-code read"
on public.live_sessions
for select
to anon, authenticated
using (
  code = coalesce(
    (current_setting('request.headers', true)::jsonb ->> 'x-picklestack-session-code'),
    ''
  )
  and expires_at > now()
);

create index if not exists live_sessions_expires_at_idx
  on public.live_sessions (expires_at);
