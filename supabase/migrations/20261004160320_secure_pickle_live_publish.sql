-- QueueZeroTwo production migration 20261004160320_secure_pickle_live_publish.
-- Reconstructed from the statements stored in the shared project's migration ledger.
create or replace function public.publish_pickle_session(
  p_code text,
  p_host_key text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
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

revoke execute on function public.publish_pickle_session(text, text, jsonb) from public;
revoke execute on function public.publish_pickle_session(text, text, jsonb) from authenticated;
grant execute on function public.publish_pickle_session(text, text, jsonb) to anon;
