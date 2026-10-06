-- Marking a message as sent records a real-world event, so it is final (D-030).
--
-- - mark_draft_sent no longer records an undo step.
-- - undo_step can no longer remove a recorded message, and never restores a
--   draft that has since been sent (whatever step asks).
--
-- A correction to a recorded message, if one is ever needed, will be its own
-- explicit workflow, not Undo.

create or replace function public.mark_draft_sent(
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
    update public.people
    set relationship_status = p_status_after, updated_at = p_at
    where id = person.id
    returning * into person;
  end if;

  return jsonb_build_object(
    'draft', to_jsonb(draft),
    'interaction', to_jsonb(message),
    'person', to_jsonb(person)
  );
end
$$;

-- Puts back what one step changed, if nothing has changed it since. Rows it
-- updated are restored first, then drafts it created are removed. It never
-- removes a recorded message and never brings back a draft that was sent.
create or replace function public.undo_step(p_step uuid)
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
        -- A sent draft stays sent: what was sent is a fact.
        update public.drafts t set
          channel = b.channel, subject = b.subject, body = b.body, origin = b.origin,
          status = b.status, approved_at = b.approved_at, sent_at = b.sent_at,
          sent_interaction_id = b.sent_interaction_id, discarded_at = b.discarded_at,
          updated_at = b.updated_at
        from jsonb_populate_record(null::public.drafts, entry -> 'before') b
        where t.id = b.id and t.status <> 'sent'
          and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
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
        where t.id = (entry ->> 'id')::uuid and t.status <> 'sent'
          and private.same_instant(t.updated_at, (entry ->> 'after')::timestamptz)
        returning t.id into removed_id;
      else
        -- Recorded messages are never removed by Undo.
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

-- Steps recorded before this migration for a mark-sent can no longer be used.
delete from private.undo_steps where operation = 'mark_draft_sent';
