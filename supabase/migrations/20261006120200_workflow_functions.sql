-- How records change: one explicit function per workflow step.
--
-- The application decides what a change is (the domain rules in src/domain,
-- run on the server) and calls one of these functions to persist it. Each
-- function re-checks, inside one transaction, what must never be bypassed:
--
-- - the record exists in the caller's workspace (RLS hides everything else, so
--   "not found" and "not yours" are the same answer);
-- - nobody changed it since the caller read it (`p_expected`, its updatedAt);
-- - the transition is allowed: only an approved draft is marked sent, editing
--   always returns a draft to awaiting approval, only open actions change,
--   onboarding completes once.
--
-- They run as reachout_writer, so row-level security applies to every
-- statement inside them. The Data API itself cannot write any table.
--
-- Errors are raised as `reachout.<code>` and mapped to calm copy by the app.

/* ——— Undo history ——— */

-- What the last few actions changed, so Undo can put records back exactly as
-- they were, provided nothing has changed them since. Pruned after a day.
create table private.undo_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  operation text not null,
  -- [{ "table": ..., "before": <row as it was>, "after": <its updated_at afterwards> }]
  updated jsonb not null default '[]',
  -- [{ "table": ..., "id": ..., "after": <its updated_at> }]
  created jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index undo_steps_workspace_idx on private.undo_steps (workspace_id, created_at);

alter table private.undo_steps enable row level security;
create policy "Undo history stays inside the member's workspace"
  on private.undo_steps for all to reachout_writer
  using (workspace_id in (select private.member_workspaces()))
  with check (workspace_id in (select private.member_workspaces()));
revoke all on private.undo_steps from public, anon, authenticated;
grant select, insert, update, delete on private.undo_steps to reachout_writer;

/* ——— Internal helpers ——— */

create function private.fail(code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'reachout.' || code;
end
$$;

-- Instants travel through the app with millisecond precision.
create function private.same_instant(a timestamptz, b timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select date_trunc('milliseconds', a) = date_trunc('milliseconds', b)
$$;

create function private.label_array(labels jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case when labels is null or jsonb_typeof(labels) = 'null' then null
              else array(select jsonb_array_elements_text(labels)) end
$$;

create function private.record_undo(
  p_workspace uuid,
  p_operation text,
  p_updated jsonb,
  p_created jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  step_id uuid;
begin
  delete from private.undo_steps
  where workspace_id = p_workspace and created_at < now() - interval '1 day';
  insert into private.undo_steps (workspace_id, operation, updated, created)
  values (p_workspace, p_operation, p_updated, p_created)
  returning id into step_id;
  return step_id;
end
$$;

revoke all on function private.fail(text) from public;
revoke all on function private.same_instant(timestamptz, timestamptz) from public;
revoke all on function private.label_array(jsonb) from public;
revoke all on function private.record_undo(uuid, text, jsonb, jsonb) from public;
grant execute on function private.fail(text) to reachout_writer;
grant execute on function private.same_instant(timestamptz, timestamptz) to reachout_writer;
grant execute on function private.label_array(jsonb) to reachout_writer;
grant execute on function private.record_undo(uuid, text, jsonb, jsonb) to reachout_writer;

/* ——— Accounts ——— */

-- First sign-in: the profile, the personal workspace and its membership,
-- exactly once however many requests race to create them.
create function public.bootstrap_account(p_name text, p_time_zone text, p_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.uid();
  my_email text := private.jwt_email();
  workspace uuid;
begin
  if me is null or my_email is null then
    perform private.fail('unauthenticated');
  end if;
  insert into public.profiles (id, name, email, time_zone, created_at, updated_at)
  values (me, p_name, my_email, p_time_zone, p_at, p_at)
  on conflict (id) do nothing;
  insert into public.workspaces (owner_id, created_at)
  values (me, p_at)
  on conflict (owner_id) do nothing;
  select w.id into workspace from public.workspaces w where w.owner_id = me;
  insert into public.workspace_members (workspace_id, profile_id, role, created_at)
  values (workspace, me, 'owner', p_at)
  on conflict do nothing;
  return workspace;
end
$$;

-- Settings: name, time zone, education and goals. The email is the sign-in
-- address and onboarding's completion is onboarding's, so neither changes here.
create function public.save_profile(
  p_name text,
  p_time_zone text,
  p_education jsonb,
  p_goals jsonb,
  p_expected timestamptz,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.profiles;
begin
  select * into profile from public.profiles where id = private.uid() for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not private.same_instant(profile.updated_at, p_expected) then
    perform private.fail('conflict');
  end if;
  update public.profiles set
    name = p_name,
    time_zone = p_time_zone,
    education_institution = p_education ->> 'institution',
    education_course = p_education ->> 'course',
    education_graduation_year = (p_education ->> 'graduation_year')::integer,
    goal_objective = p_goals ->> 'objective',
    goal_target_roles = private.label_array(p_goals -> 'target_roles'),
    goal_target_sectors = private.label_array(p_goals -> 'target_sectors'),
    goal_target_locations = private.label_array(p_goals -> 'target_locations'),
    updated_at = p_at
  where id = profile.id
  returning * into profile;
  return to_jsonb(profile);
end
$$;

-- Onboarding's outcome (DOMAIN.md › Onboarding → records), all or nothing,
-- once. A second submission waits for the first and is refused.
create function public.complete_onboarding(p_records jsonb, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.profiles;
  workspace uuid;
  goals jsonb := p_records -> 'goals';
begin
  select * into profile from public.profiles where id = private.uid() for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if profile.onboarding_completed_at is not null then
    perform private.fail('onboarding_complete');
  end if;
  workspace := private.current_workspace();

  update public.profiles set
    time_zone = coalesce(p_records ->> 'time_zone', time_zone),
    goal_objective = goals ->> 'objective',
    goal_target_roles = private.label_array(goals -> 'target_roles'),
    goal_target_sectors = private.label_array(goals -> 'target_sectors'),
    goal_target_locations = private.label_array(goals -> 'target_locations'),
    onboarding_completed_at = p_at,
    updated_at = p_at
  where id = profile.id;

  insert into public.companies (id, workspace_id, name, website, sector, location, notes, created_at, updated_at)
  select r.id, workspace, r.name, r.website, r.sector, r.location, r.notes, r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.companies, coalesce(p_records -> 'companies', '[]')) r;

  insert into public.people (
    id, workspace_id, name, role, company_id, source_kind, source_detail, email, linkedin_url,
    location, why_relevant, notes, relationship_status, preferred_channel, created_at, updated_at
  )
  select r.id, workspace, r.name, r.role, r.company_id, r.source_kind, r.source_detail, r.email,
         r.linkedin_url, r.location, r.why_relevant, r.notes, r.relationship_status,
         r.preferred_channel, r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.people, coalesce(p_records -> 'people', '[]')) r;

  insert into public.opportunities (
    id, workspace_id, title, company_id, status, closed_reason, type, priority, deadline, url,
    notes, created_at, updated_at
  )
  select r.id, workspace, r.title, r.company_id, r.status, r.closed_reason, r.type, r.priority,
         r.deadline, r.url, r.notes, r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.opportunities, coalesce(p_records -> 'opportunities', '[]')) r;

  insert into public.opportunity_people (workspace_id, opportunity_id, person_id, position)
  select workspace, r.opportunity_id, r.person_id, r.position
  from jsonb_populate_recordset(
    null::public.opportunity_people, coalesce(p_records -> 'opportunity_people', '[]')
  ) r;

  insert into public.next_actions (
    id, workspace_id, kind, title, person_id, opportunity_id, interaction_id, due_on, status,
    created_at, updated_at
  )
  select r.id, workspace, r.kind, r.title, r.person_id, r.opportunity_id, r.interaction_id,
         r.due_on, 'open', r.created_at, r.updated_at
  from jsonb_populate_recordset(null::public.next_actions, coalesce(p_records -> 'next_actions', '[]')) r;
end
$$;

/* ——— Next actions ——— */

create function public.complete_next_action(p_id uuid, p_expected timestamptz, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action public.next_actions;
  before jsonb;
  step uuid;
begin
  select * into action from public.next_actions where id = p_id for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not private.same_instant(action.updated_at, p_expected) then
    perform private.fail('conflict');
  end if;
  if action.status <> 'open' then
    perform private.fail('next_action_not_open');
  end if;
  before := to_jsonb(action);
  update public.next_actions
  set status = 'done', completed_at = p_at, updated_at = p_at
  where id = action.id
  returning * into action;
  step := private.record_undo(
    action.workspace_id, 'complete_next_action',
    jsonb_build_array(jsonb_build_object('table', 'next_actions', 'before', before, 'after', p_at)),
    '[]'
  );
  return jsonb_build_object('next_action', to_jsonb(action), 'undo', step);
end
$$;

-- Snooze and reschedule: the app computes the date with the domain's rule.
create function public.reschedule_next_action(
  p_id uuid,
  p_due_on date,
  p_expected timestamptz,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action public.next_actions;
  before jsonb;
  step uuid;
begin
  select * into action from public.next_actions where id = p_id for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not private.same_instant(action.updated_at, p_expected) then
    perform private.fail('conflict');
  end if;
  if action.status <> 'open' then
    perform private.fail('next_action_not_open');
  end if;
  before := to_jsonb(action);
  update public.next_actions
  set due_on = p_due_on, updated_at = p_at
  where id = action.id
  returning * into action;
  step := private.record_undo(
    action.workspace_id, 'reschedule_next_action',
    jsonb_build_array(jsonb_build_object('table', 'next_actions', 'before', before, 'after', p_at)),
    '[]'
  );
  return jsonb_build_object('next_action', to_jsonb(action), 'undo', step);
end
$$;

/* ——— Drafts: draft → approval → send it yourself → mark sent ——— */

-- A message the user wrote. It always starts awaiting approval.
create function public.create_draft(p_draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.drafts := jsonb_populate_record(null::public.drafts, p_draft);
  person public.people;
  step uuid;
begin
  select * into person from public.people where id = draft.person_id;
  if not found then
    perform private.fail('not_found');
  end if;
  insert into public.drafts (
    id, workspace_id, person_id, opportunity_id, channel, subject, body, origin, status,
    created_at, updated_at
  )
  values (
    draft.id, person.workspace_id, person.id, draft.opportunity_id, draft.channel, draft.subject,
    draft.body, 'user', 'awaiting_approval', draft.created_at, draft.created_at
  )
  returning * into draft;
  step := private.record_undo(
    draft.workspace_id, 'create_draft', '[]',
    jsonb_build_array(jsonb_build_object('table', 'drafts', 'id', draft.id, 'after', draft.updated_at))
  );
  return jsonb_build_object('draft', to_jsonb(draft), 'undo', step);
end
$$;

create function public.approve_draft(p_id uuid, p_expected timestamptz, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.drafts;
  before jsonb;
  step uuid;
begin
  select * into draft from public.drafts where id = p_id for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not private.same_instant(draft.updated_at, p_expected) then
    perform private.fail('conflict');
  end if;
  if draft.status <> 'awaiting_approval' then
    perform private.fail('draft_not_awaiting_approval');
  end if;
  if draft.channel = 'email' and draft.subject is null then
    perform private.fail('email_subject_required');
  end if;
  before := to_jsonb(draft);
  update public.drafts
  set status = 'approved', approved_at = p_at, updated_at = p_at
  where id = draft.id
  returning * into draft;
  step := private.record_undo(
    draft.workspace_id, 'approve_draft',
    jsonb_build_array(jsonb_build_object('table', 'drafts', 'before', before, 'after', p_at)),
    '[]'
  );
  return jsonb_build_object('draft', to_jsonb(draft), 'undo', step);
end
$$;

-- Approval covers the exact content: any edit returns the draft for approval.
create function public.revise_draft(
  p_id uuid,
  p_subject text,
  p_body text,
  p_expected timestamptz,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.drafts;
  before jsonb;
  step uuid;
begin
  select * into draft from public.drafts where id = p_id for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not private.same_instant(draft.updated_at, p_expected) then
    perform private.fail('conflict');
  end if;
  if draft.status not in ('awaiting_approval', 'approved') then
    perform private.fail('draft_not_editable');
  end if;
  before := to_jsonb(draft);
  update public.drafts
  set subject = p_subject, body = p_body, status = 'awaiting_approval', approved_at = null,
      updated_at = p_at
  where id = draft.id
  returning * into draft;
  step := private.record_undo(
    draft.workspace_id, 'revise_draft',
    jsonb_build_array(jsonb_build_object('table', 'drafts', 'before', before, 'after', p_at)),
    '[]'
  );
  return jsonb_build_object('draft', to_jsonb(draft), 'undo', step);
end
$$;

-- The user sent an approved draft themselves. Records the message_sent it
-- became and the person's relationship status after it (computed by the app
-- with relationshipStatusAfter, applied only if the status is still the one
-- the app saw). Nothing is sent from here.
create function public.mark_draft_sent(
  p_id uuid,
  p_interaction_id uuid,
  p_summary text,
  p_status_before text,
  p_status_after text,
  p_expected timestamptz,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.drafts;
  person public.people;
  message public.interactions;
  draft_before jsonb;
  updated jsonb;
  step uuid;
begin
  select * into draft from public.drafts where id = p_id for update;
  if not found then
    perform private.fail('not_found');
  end if;
  if not private.same_instant(draft.updated_at, p_expected) then
    perform private.fail('conflict');
  end if;
  if draft.status <> 'approved' then
    perform private.fail('draft_not_approved');
  end if;
  select * into person from public.people
  where workspace_id = draft.workspace_id and id = draft.person_id
  for update;
  if person.relationship_status <> p_status_before then
    perform private.fail('conflict');
  end if;
  draft_before := to_jsonb(draft);
  updated := jsonb_build_array(jsonb_build_object('table', 'drafts', 'before', draft_before, 'after', p_at));

  insert into public.interactions (
    id, workspace_id, person_id, opportunity_id, kind, occurred_at, summary, channel, subject, body,
    created_at, updated_at
  )
  values (
    p_interaction_id, draft.workspace_id, draft.person_id, draft.opportunity_id, 'message_sent',
    p_at, p_summary, draft.channel, draft.subject, draft.body, p_at, p_at
  )
  returning * into message;

  update public.drafts
  set status = 'sent', sent_at = p_at, sent_interaction_id = message.id, updated_at = p_at
  where id = draft.id
  returning * into draft;

  if p_status_after <> person.relationship_status then
    updated := updated || jsonb_build_object('table', 'people', 'before', to_jsonb(person), 'after', p_at);
    update public.people
    set relationship_status = p_status_after, updated_at = p_at
    where id = person.id
    returning * into person;
  end if;

  step := private.record_undo(
    draft.workspace_id, 'mark_draft_sent', updated,
    jsonb_build_array(jsonb_build_object('table', 'interactions', 'id', message.id, 'after', p_at))
  );
  return jsonb_build_object(
    'draft', to_jsonb(draft),
    'interaction', to_jsonb(message),
    'person', to_jsonb(person),
    'undo', step
  );
end
$$;

/* ——— Undo ——— */

-- Puts back what one step changed, if nothing has changed it since. Rows it
-- updated are restored first, then rows it created are removed.
create function public.undo_step(p_step uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  step private.undo_steps;
  entry jsonb;
  row_after jsonb;
  removed_id uuid;
  restored jsonb := '[]';
  removed jsonb := '[]';
begin
  select * into step from private.undo_steps where id = p_step for update;
  if not found then
    perform private.fail('undo_unavailable');
  end if;

  for entry in select * from jsonb_array_elements(step.updated)
  loop
    row_after := null;
    case entry ->> 'table'
      when 'next_actions' then
        update public.next_actions t set
          kind = b.kind, title = b.title, person_id = b.person_id, opportunity_id = b.opportunity_id,
          interaction_id = b.interaction_id, due_on = b.due_on, status = b.status,
          completed_at = b.completed_at, dismissed_at = b.dismissed_at, updated_at = b.updated_at
        from jsonb_populate_record(null::public.next_actions, entry -> 'before') b
        where t.id = b.id and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
        returning to_jsonb(t.*) into row_after;
      when 'drafts' then
        update public.drafts t set
          channel = b.channel, subject = b.subject, body = b.body, origin = b.origin,
          status = b.status, approved_at = b.approved_at, sent_at = b.sent_at,
          sent_interaction_id = b.sent_interaction_id, discarded_at = b.discarded_at,
          updated_at = b.updated_at
        from jsonb_populate_record(null::public.drafts, entry -> 'before') b
        where t.id = b.id and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
        returning to_jsonb(t.*) into row_after;
      when 'people' then
        update public.people t set
          name = b.name, role = b.role, company_id = b.company_id, source_kind = b.source_kind,
          source_detail = b.source_detail, email = b.email, linkedin_url = b.linkedin_url,
          location = b.location, why_relevant = b.why_relevant, notes = b.notes,
          relationship_status = b.relationship_status, preferred_channel = b.preferred_channel,
          outreach_closed_at = b.outreach_closed_at,
          outreach_closure_reason = b.outreach_closure_reason, updated_at = b.updated_at
        from jsonb_populate_record(null::public.people, entry -> 'before') b
        where t.id = b.id and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
        returning to_jsonb(t.*) into row_after;
      else
        perform private.fail('undo_unavailable');
    end case;
    if row_after is null then
      perform private.fail('conflict');
    end if;
    restored := restored || jsonb_build_object('table', entry ->> 'table', 'row', row_after);
  end loop;

  for entry in select * from jsonb_array_elements(step.created)
  loop
    removed_id := null;
    case entry ->> 'table'
      when 'drafts' then
        delete from public.drafts t
        where t.id = (entry ->> 'id')::uuid
          and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
        returning t.id into removed_id;
      when 'interactions' then
        delete from public.interactions t
        where t.id = (entry ->> 'id')::uuid
          and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
        returning t.id into removed_id;
      else
        perform private.fail('undo_unavailable');
    end case;
    if removed_id is null then
      perform private.fail('conflict');
    end if;
    removed := removed || jsonb_build_object('table', entry ->> 'table', 'id', removed_id);
  end loop;

  delete from private.undo_steps where id = step.id;
  return jsonb_build_object('restored', restored, 'removed', removed);
end
$$;

/* ——— Who may call what ——— */

-- The functions run as reachout_writer (which must be able to create in the
-- schema to own them). Only signed-in users may call them.
grant create on schema public to reachout_writer;
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.bootstrap_account(text, text, timestamptz)',
    'public.save_profile(text, text, jsonb, jsonb, timestamptz, timestamptz)',
    'public.complete_onboarding(jsonb, timestamptz)',
    'public.complete_next_action(uuid, timestamptz, timestamptz)',
    'public.reschedule_next_action(uuid, date, timestamptz, timestamptz)',
    'public.create_draft(jsonb)',
    'public.approve_draft(uuid, timestamptz, timestamptz)',
    'public.revise_draft(uuid, text, text, timestamptz, timestamptz)',
    'public.mark_draft_sent(uuid, uuid, text, text, text, timestamptz, timestamptz)',
    'public.undo_step(uuid)'
  ]
  loop
    execute format('alter function %s owner to reachout_writer', fn);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$$;
revoke create on schema public from reachout_writer;
