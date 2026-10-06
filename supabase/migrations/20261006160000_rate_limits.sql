-- Small, durable rate limits for actions that could be spammed (D-032):
-- requesting sign-in links, starting Gmail authorisation, and "Check now".
--
-- Supabase Auth sees Reachout's server, not the student, so its own per-IP
-- limits are shared by everyone; these limits are per email address, per
-- client address and per user instead. Keys arrive as HMACs the app computes
-- with a server secret, so nothing personal is stored and nobody can spend
-- someone else's allowance by guessing their address. The limits themselves
-- live here, not in the caller's hands.

create table private.rate_limit_hits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (bucket, key_hash, window_start)
);
create index rate_limit_hits_window_idx on private.rate_limit_hits (window_start);

alter table private.rate_limit_hits enable row level security;
create policy "Only the rate limiter counts"
  on private.rate_limit_hits for all to reachout_writer
  using (true)
  with check (true);
revoke all on private.rate_limit_hits from public, anon, authenticated;
grant select, insert, update, delete on private.rate_limit_hits to reachout_writer;

-- Counts one attempt and says whether it is allowed (fixed windows).
create function public.take_rate_limit(p_bucket text, p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed integer;
  seconds integer;
  started timestamptz;
  counted integer;
begin
  case p_bucket
    when 'sign_in_email' then allowed := 5; seconds := 900;
    when 'sign_in_address' then allowed := 30; seconds := 900;
    when 'gmail_connect' then allowed := 10; seconds := 3600;
    when 'gmail_check' then allowed := 6; seconds := 300;
    else perform private.fail('invalid');
  end case;
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    perform private.fail('invalid');
  end if;

  started := to_timestamp(floor(extract(epoch from now()) / seconds) * seconds);
  insert into private.rate_limit_hits as h (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, started, 1)
  on conflict (bucket, key_hash, window_start) do update set hits = h.hits + 1
  returning h.hits into counted;

  -- Old windows are forgotten now and then.
  if random() < 0.02 then
    delete from private.rate_limit_hits where window_start < now() - interval '1 day';
  end if;
  return counted <= allowed;
end
$$;

grant create on schema public to reachout_writer;
alter function public.take_rate_limit(text, text) owner to reachout_writer;
revoke create on schema public from reachout_writer;
revoke all on function public.take_rate_limit(text, text) from public, anon, authenticated, service_role;
-- Signing in happens before there is a session, so anon may call it too.
grant execute on function public.take_rate_limit(text, text) to anon, authenticated;
