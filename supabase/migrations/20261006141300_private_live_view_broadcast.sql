-- QueueZeroTwo: authorize Live View private Broadcasts without client send access.
-- Realtime already has RLS enabled; do not alter that setting here.

create or replace function public.live_sessions_broadcast()
returns trigger
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
language plpgsql;


revoke execute on function public.live_sessions_broadcast() from public;
revoke execute on function public.live_sessions_broadcast() from anon;
revoke execute on function public.live_sessions_broadcast() from authenticated;

drop policy if exists "live view receive session broadcasts" on realtime.messages;
create policy "live view receive session broadcasts"
on realtime.messages for select to anon, authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) like 'session:%'
);
