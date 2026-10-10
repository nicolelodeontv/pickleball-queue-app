-- QueueZeroTwo production migration 20261005190017_live_view_broadcast_transport_v2.
-- This historical transport published a non-private broadcast; the immediately
-- following migration switches to the private channel and adds its receive policy.
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
    false
  );
  return coalesce(new, old);
end
$function$;

revoke execute on function public.live_sessions_broadcast() from public, anon, authenticated;

drop trigger if exists live_sessions_broadcast_trigger on public.live_sessions;
create trigger live_sessions_broadcast_trigger
after insert or update or delete on public.live_sessions
for each row
execute function public.live_sessions_broadcast();
