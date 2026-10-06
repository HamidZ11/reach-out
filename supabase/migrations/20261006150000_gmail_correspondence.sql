-- Gmail as a read-only correspondence connector (D-031).
--
-- Reachout never sends, changes or deletes mail. With the user's permission it
-- reads message headers to notice what they sent to, and received from,
-- people they track, and adds those messages to the relationship history.
--
-- - gmail_connections: which Gmail account a workspace connected, and how
--   syncing stands. Readable by the workspace's members.
-- - private.gmail_credentials: the refresh token, sealed by the app (AES-256-GCM)
--   before it arrives here. Never readable through the Data API.
-- - gmail_messages: the adapter's map from a provider message to the
--   interaction it became. It makes syncing idempotent, and stores no mail
--   content of its own (ARCHITECTURE.md › Email integration boundary).
--
-- Only correspondence with a tracked person is stored, as an ordinary
-- interaction (subject and time; never bodies or attachments).

create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  email_address text not null check (position('@' in email_address) > 1),
  scopes text[] not null,
  status text not null check (status in ('connected', 'needs_reconnect')),
  -- Gmail's history id: where the next sync continues from.
  history_cursor text check (history_cursor ~ '^[0-9]{1,30}$'),
  connected_at timestamptz not null,
  last_synced_at timestamptz,
  last_error text check (last_error in ('revoked', 'permission', 'unavailable', 'history_reset')),
  -- A running sync's lease, so two never run at once for one account.
  sync_started_at timestamptz,
  updated_at timestamptz not null,
  -- V1: one Gmail account per workspace.
  constraint gmail_connections_one_per_workspace unique (workspace_id)
);

create table private.gmail_credentials (
  connection_id uuid primary key references public.gmail_connections (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sealed_refresh_token text not null check (sealed_refresh_token like 'v1.%'),
  key_id text not null check (key_id ~ '^[0-9a-f]{16}$'),
  updated_at timestamptz not null
);

create table public.gmail_messages (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider_message_id text not null check (provider_message_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  person_id uuid not null,
  interaction_id uuid not null,
  thread_id text check (thread_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  direction text not null check (direction in ('sent', 'received')),
  interaction_kind text generated always as (
    case direction when 'sent' then 'message_sent' else 'message_received' end
  ) stored,
  recorded_at timestamptz not null,
  -- Recorded once per person, however often syncing sees it.
  primary key (workspace_id, provider_message_id, person_id),
  -- An interaction is at most one provider message.
  constraint gmail_messages_one_per_interaction unique (interaction_id),
  constraint gmail_messages_person_fkey foreign key (workspace_id, person_id)
    references public.people (workspace_id, id),
  -- Sent maps to a message_sent, received to a message_received, with that same person.
  constraint gmail_messages_interaction_fkey
    foreign key (workspace_id, interaction_id, person_id, interaction_kind)
    references public.interactions (workspace_id, id, person_id, kind)
);
create index gmail_messages_person_idx on public.gmail_messages (workspace_id, person_id);

/* ——— Access ——— */

alter table public.gmail_connections enable row level security;
alter table public.gmail_messages enable row level security;
alter table private.gmail_credentials enable row level security;

create policy "Members can read their workspace's Gmail connection"
  on public.gmail_connections for select to authenticated, reachout_writer
  using (workspace_id in (select private.member_workspaces()));
create policy "Writes stay inside the member's workspace"
  on public.gmail_connections for all to reachout_writer
  using (workspace_id in (select private.member_workspaces()))
  with check (workspace_id in (select private.member_workspaces()));

create policy "Members can read their workspace's records"
  on public.gmail_messages for select to authenticated, reachout_writer
  using (workspace_id in (select private.member_workspaces()));
create policy "Writes stay inside the member's workspace"
  on public.gmail_messages for all to reachout_writer
  using (workspace_id in (select private.member_workspaces()))
  with check (workspace_id in (select private.member_workspaces()));

create policy "Credentials stay inside the member's workspace"
  on private.gmail_credentials for all to reachout_writer
  using (workspace_id in (select private.member_workspaces()))
  with check (workspace_id in (select private.member_workspaces()));

revoke all on public.gmail_connections, public.gmail_messages from public, anon, authenticated;
revoke all on private.gmail_credentials from public, anon, authenticated;
grant select on public.gmail_connections, public.gmail_messages to authenticated;
grant select, insert, update, delete on public.gmail_connections, public.gmail_messages to reachout_writer;
grant select, insert, update, delete on private.gmail_credentials to reachout_writer;

/* ——— Workflow functions ——— */

-- After the user granted access: the account, its sealed refresh token, and
-- where syncing starts (now: earlier mail is not imported).
create function public.connect_gmail(
  p_email text,
  p_scopes text[],
  p_sealed_refresh_token text,
  p_key_id text,
  p_history_cursor text,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace uuid := private.current_workspace();
  connection public.gmail_connections;
begin
  insert into public.gmail_connections (
    workspace_id, profile_id, email_address, scopes, status, history_cursor, connected_at, updated_at
  )
  values (workspace, private.uid(), lower(p_email), p_scopes, 'connected', p_history_cursor, p_at, p_at)
  on conflict (workspace_id) do update set
    profile_id = excluded.profile_id,
    email_address = excluded.email_address,
    scopes = excluded.scopes,
    status = 'connected',
    history_cursor = excluded.history_cursor,
    connected_at = excluded.connected_at,
    last_synced_at = null,
    last_error = null,
    sync_started_at = null,
    updated_at = excluded.updated_at
  returning * into connection;

  insert into private.gmail_credentials (connection_id, workspace_id, sealed_refresh_token, key_id, updated_at)
  values (connection.id, workspace, p_sealed_refresh_token, p_key_id, p_at)
  on conflict (connection_id) do update set
    sealed_refresh_token = excluded.sealed_refresh_token,
    key_id = excluded.key_id,
    updated_at = excluded.updated_at;

  return to_jsonb(connection);
end
$$;

-- Forgets the connection and its credentials. History already recorded stays.
-- Returns the sealed token once, so the app can ask Google to revoke it.
create function public.disconnect_gmail()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.gmail_connections;
  credential private.gmail_credentials;
begin
  select * into connection from public.gmail_connections
  where workspace_id = private.current_workspace()
  for update;
  if not found then
    return null;
  end if;
  select * into credential from private.gmail_credentials where connection_id = connection.id;
  delete from public.gmail_connections where id = connection.id;
  return jsonb_build_object(
    'sealed_refresh_token', credential.sealed_refresh_token,
    'key_id', credential.key_id
  );
end
$$;

-- Starts a sync if one is due (not synced for p_min_interval_seconds) and none
-- is running. A lease older than two minutes is treated as abandoned.
create function public.begin_gmail_sync(p_min_interval_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection public.gmail_connections;
  credential private.gmail_credentials;
begin
  update public.gmail_connections c
  set sync_started_at = now()
  where c.workspace_id = private.current_workspace()
    and c.status = 'connected'
    and (c.sync_started_at is null or c.sync_started_at < now() - interval '2 minutes')
    and (
      c.last_synced_at is null
      or c.last_synced_at < now() - make_interval(secs => greatest(p_min_interval_seconds, 0))
    )
  returning * into connection;
  if not found then
    return null;
  end if;
  select * into credential from private.gmail_credentials where connection_id = connection.id;
  if not found then
    update public.gmail_connections set sync_started_at = null where id = connection.id;
    return null;
  end if;
  return jsonb_build_object(
    'connection', to_jsonb(connection),
    'sealed_refresh_token', credential.sealed_refresh_token,
    'key_id', credential.key_id
  );
end
$$;

-- Ends a sync: where it got to, and how it went. A revoked or narrowed
-- permission stops syncing until the user reconnects.
create function public.finish_gmail_sync(p_connection uuid, p_outcome text, p_history_cursor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('synced', 'history_reset', 'unavailable', 'revoked', 'permission') then
    perform private.fail('invalid');
  end if;
  update public.gmail_connections set
    sync_started_at = null,
    history_cursor = coalesce(p_history_cursor, history_cursor),
    last_synced_at = case when p_outcome in ('synced', 'history_reset') then now() else last_synced_at end,
    status = case when p_outcome in ('revoked', 'permission') then 'needs_reconnect' else status end,
    last_error = case when p_outcome = 'synced' then null else p_outcome end,
    updated_at = now()
  where id = p_connection;
  if not found then
    perform private.fail('not_found');
  end if;
end
$$;

-- One provider message, for one tracked person, into the history: exactly
-- once. The app decides (src/domain/correspondence.ts) whether it is new,
-- the same message the user marked sent by hand ('link'), or how an approved
-- draft was sent ('draft'); this re-checks each against what is stored.
-- Nothing is recorded while the workspace has no connected Gmail account.
create function public.record_gmail_message(p_message jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  person public.people;
  message public.interactions;
  draft public.drafts;
  direction text := p_message ->> 'direction';
  how text := p_message ->> 'kind';
  at timestamptz := (p_message ->> 'at')::timestamptz;
  occurred timestamptz := (p_message ->> 'occurred_at')::timestamptz;
begin
  if direction not in ('sent', 'received') or how not in ('new', 'link', 'draft')
     or (how <> 'new' and direction <> 'sent') then
    perform private.fail('invalid');
  end if;

  select * into person from public.people where id = (p_message ->> 'person_id')::uuid for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not exists (
    select 1 from public.gmail_connections c
    where c.workspace_id = person.workspace_id and c.status = 'connected'
  ) then
    perform private.fail('not_found');
  end if;
  if exists (
    select 1 from public.gmail_messages m
    where m.workspace_id = person.workspace_id
      and m.provider_message_id = p_message ->> 'provider_message_id'
      and m.person_id = person.id
  ) then
    return jsonb_build_object('outcome', 'duplicate');
  end if;

  if how = 'link' then
    select * into message from public.interactions i
    where i.workspace_id = person.workspace_id
      and i.id = (p_message ->> 'link_interaction_id')::uuid
      and i.person_id = person.id
      and i.kind = 'message_sent'
      and i.channel = 'email';
    if not found then
      perform private.fail('not_found');
    end if;
  else
    if person.relationship_status <> p_message ->> 'status_before' then
      perform private.fail('conflict');
    end if;
    if how = 'draft' then
      select * into draft from public.drafts d
      where d.workspace_id = person.workspace_id
        and d.id = (p_message ->> 'draft_id')::uuid
        and d.person_id = person.id
      for update;
      if not found then
        perform private.fail('not_found');
      end if;
      if not private.same_instant(draft.updated_at, (p_message ->> 'draft_expected')::timestamptz) then
        perform private.fail('conflict');
      end if;
      if draft.status <> 'approved' or draft.channel <> 'email' then
        perform private.fail('draft_not_approved');
      end if;
    end if;

    insert into public.interactions (
      id, workspace_id, person_id, opportunity_id, kind, occurred_at, summary, channel, subject,
      created_at, updated_at
    )
    values (
      (p_message ->> 'interaction_id')::uuid, person.workspace_id, person.id, draft.opportunity_id,
      case direction when 'sent' then 'message_sent' else 'message_received' end,
      occurred, p_message ->> 'summary', 'email', nullif(btrim(p_message ->> 'subject'), ''),
      at, at
    )
    returning * into message;

    if how = 'draft' then
      update public.drafts
      set status = 'sent', sent_at = occurred, sent_interaction_id = message.id, updated_at = at
      where id = draft.id
      returning * into draft;
    end if;

    if p_message ->> 'status_after' <> person.relationship_status then
      update public.people
      set relationship_status = p_message ->> 'status_after', updated_at = at
      where id = person.id
      returning * into person;
    end if;
  end if;

  insert into public.gmail_messages (
    workspace_id, provider_message_id, person_id, interaction_id, thread_id, direction, recorded_at
  )
  values (
    person.workspace_id, p_message ->> 'provider_message_id', person.id, message.id,
    p_message ->> 'thread_id', direction, at
  );

  return jsonb_build_object(
    'outcome', case how when 'link' then 'linked' else 'recorded' end,
    'interaction', to_jsonb(message),
    'draft', case when draft.id is null then null else to_jsonb(draft) end,
    'person', to_jsonb(person)
  );
end
$$;

grant create on schema public to reachout_writer;
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.connect_gmail(text, text[], text, text, text, timestamptz)',
    'public.disconnect_gmail()',
    'public.begin_gmail_sync(integer)',
    'public.finish_gmail_sync(uuid, text, text)',
    'public.record_gmail_message(jsonb)'
  ]
  loop
    execute format('alter function %s owner to reachout_writer', fn);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$$;
revoke create on schema public from reachout_writer;
