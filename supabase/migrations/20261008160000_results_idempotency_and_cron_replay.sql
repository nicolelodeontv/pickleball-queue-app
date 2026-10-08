-- QueueZeroTwo Release 2 follow-up:
-- local replay support plus live-session idempotency for immutable results.

create extension if not exists pg_cron with schema pg_catalog;

alter table public.pickle_results
  add column live_code text;

alter table public.pickle_results
  add constraint pickle_results_live_code_check
  check (live_code ~ '^[A-Za-z0-9]{4,10}$');

alter table public.pickle_results
  add constraint pickle_results_live_code_key unique (live_code);

alter table public.pickle_results
  alter column live_code set not null;

drop function if exists public.publish_pickle_results(text,text,text,jsonb);

create or replace function public.publish_pickle_results(
  p_live_code text,
  p_host_key text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_host_key_hash text;
  v_results_code text;
  v_existing_code text;
  v_bytes bytea;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  if p_live_code is null or p_live_code !~ '^[A-Za-z0-9]{4,10}$' then
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

  if not exists (
    select 1
    from public.live_sessions
    where code = p_live_code
      and host_key = v_host_key_hash
      and expires_at > now()
  ) then
    raise exception 'Invalid host key or expired session.';
  end if;

  loop
    v_bytes := extensions.gen_random_bytes(10);
    v_results_code := '';
    for i in 0..9 loop
      v_results_code := v_results_code ||
        substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.pickle_results (
        live_code,
        code,
        data,
        created_at,
        expires_at
      )
      values (
        p_live_code,
        v_results_code,
        p_payload,
        now(),
        now() + interval '30 days'
      )
      on conflict (live_code) do nothing;

      if found then
        return v_results_code;
      end if;

      select code
        into v_existing_code
        from public.pickle_results
       where live_code = p_live_code;

      if v_existing_code is not null then
        return v_existing_code;
      end if;
    exception
      when unique_violation then
        -- Extremely unlikely collision on the random result code; generate another.
        continue;
    end;
  end loop;
end;
$function$;

revoke all on function public.publish_pickle_results(text,text,text,jsonb) from public;
revoke execute on function public.publish_pickle_results(text,text,text,jsonb) from authenticated;
grant execute on function public.publish_pickle_results(text,text,text,jsonb) to anon;