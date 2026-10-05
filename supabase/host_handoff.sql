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
