-- QueueZeroTwo secure Live View baseline.
-- Schema-only: no production rows or test session codes are included.
-- This baseline replaces the old public-policy setup for a fresh PickleStack DB.

create table public.live_sessions (
  code text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  host_key text not null,
  expires_at timestamptz default (now() + interval '7 days'),
  constraint live_sessions_host_key_check
    check (host_key ~ '^[0-9a-f]{64}$'),
  constraint live_sessions_payload_size_check
    check (octet_length(data::text) <= 200000)
);

alter table public.live_sessions enable row level security;

revoke all on table public.live_sessions from public;
revoke all on table public.live_sessions from anon;
revoke all on table public.live_sessions from authenticated;
grant select on table public.live_sessions to anon, authenticated;

drop policy if exists "PickleStack live exact-code read" on public.live_sessions;
create policy "PickleStack live exact-code read"
on public.live_sessions
for select
to anon, authenticated
using (
  code = coalesce(
    (current_setting('request.headers', true))::jsonb ->> 'x-picklestack-session-code',
    ''
  )
  and expires_at > now()
);

create or replace function public.publish_pickle_session(
  p_code text,
  p_host_key text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_host_key_hash text;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{4,10}$' then
    raise exception 'Invalid session code.';
  end if;

  if p_host_key is null or p_host_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid host key.';
  end if;

  if p_payload is null then
    raise exception 'Payload is required.';
  end if;

  if octet_length(p_payload::text) > 200000 then
    raise exception 'Payload too large.';
  end if;

  v_host_key_hash := encode(
    extensions.digest(p_host_key, 'sha256'),
    'hex'
  );

  insert into public.live_sessions (
    code,
    host_key,
    data,
    updated_at,
    expires_at
  )
  values (
    p_code,
    v_host_key_hash,
    p_payload,
    now(),
    now() + interval '7 days'
  )
  on conflict (code) do update
  set
    data = excluded.data,
    updated_at = excluded.updated_at,
    expires_at = excluded.expires_at
  where public.live_sessions.host_key = excluded.host_key
    and public.live_sessions.expires_at > now();

  if not found then
    raise exception 'Invalid host key or expired session.';
  end if;

  return true;
end;
$function$;

revoke all on function public.publish_pickle_session(text, text, jsonb) from public;
revoke execute on function public.publish_pickle_session(text, text, jsonb) from authenticated;
grant execute on function public.publish_pickle_session(text, text, jsonb) to anon;
