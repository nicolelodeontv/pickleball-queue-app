-- QueueZeroTwo host handoff RPC.
-- Run this only after the original live-session table setup has been applied.
-- Do not re-run supabase.sql on an existing production database: it contains the
-- original public policies and can reopen access that the RPC-based publish flow
-- is intended to replace.

create or replace function public.rotate_pickle_host_key(
  p_code text,
  p_old_key text,
  p_new_key text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{4,10}$' then
    raise exception 'Invalid session code.';
  end if;

  if p_old_key is null
     or p_old_key !~ '^[0-9a-f]{64}$'
     or p_new_key is null
     or p_new_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid host key.';
  end if;

  update public.live_sessions
     set host_key = encode(extensions.digest(p_new_key, 'sha256'), 'hex'),
         updated_at = now(),
         expires_at = now() + interval '7 days'
   where code = p_code
     and host_key = encode(extensions.digest(p_old_key, 'sha256'), 'hex')
     and expires_at > now();

  if not found then
    raise exception 'Invalid host key or expired session.';
  end if;

  return true;
end
$function$;


grant execute on function public.rotate_pickle_host_key(text, text, text)
  to anon, authenticated;


-- Live View realtime transport:
-- The browser cannot send the custom x-picklestack-session-code header over a native
-- WebSocket, so Postgres Changes cannot use the existing exact-code RLS policy for
-- anonymous viewers. Broadcast from the database preserves the session-code access
-- model without exposing host_key in the broadcast payload.
create or replace function public.live_sessions_broadcast()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text := coalesce(new.code, old.code);
  v_data jsonb := case when new.code is null then null else new.data end;
  v_updated_at timestamptz := case when new.code is null then now() else new.updated_at end;
  v_expires_at timestamptz := case when new.code is null then now() else new.expires_at end;
begin
  perform realtime.send(
    jsonb_build_object(
      'code', v_code,
      'data', v_data,
      'updated_at', v_updated_at,
      'expires_at', v_expires_at
    ),
    'session_update',
    'session:' || v_code,
    true
  );
  return coalesce(new, old);
end
$function$;

revoke execute on function public.live_sessions_broadcast() from public;
revoke execute on function public.live_sessions_broadcast() from anon;
revoke execute on function public.live_sessions_broadcast() from authenticated;

drop trigger if exists live_sessions_broadcast_trigger on public.live_sessions;
create trigger live_sessions_broadcast_trigger
after insert or update or delete on public.live_sessions
for each row
execute function public.live_sessions_broadcast();

-- Live View viewers receive private broadcast events but have no insert policy,
-- so a browser holding a session link can listen but cannot forge score updates.
drop policy if exists "live view receive session broadcasts" on realtime.messages;
create policy "live view receive session broadcasts"
on realtime.messages for select to anon, authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) like 'session:%'
);
