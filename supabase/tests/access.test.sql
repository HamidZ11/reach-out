-- Access rules that must hold for every migration, checked in the database
-- itself with pgTAP (`pnpm db:test`). The Vitest database suite checks the
-- same rules through the Data API, as real signed-in users.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'every table in public has row-level security enabled'
);

select is(
  (select array_agg(t.table_name::text order by t.table_name)
   from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name)),
  null,
  'every table in public has at least one policy'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema in ('public', 'private') and grantee in ('anon', 'PUBLIC')),
  0,
  'signed out, no table can be read or written'
);

select is(
  (select array_agg(distinct privilege_type::text)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'),
  array['SELECT'],
  'signed in, tables can only be read (row-level security decides which rows)'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'private' and grantee = 'authenticated'),
  0,
  'the undo history is never readable through the Data API'
);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and has_function_privilege('anon', p.oid, 'execute')),
  array['take_rate_limit'],
  'signed out, the only callable function is the sign-in rate limit'
);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (pg_get_userbyid(p.proowner) <> 'reachout_writer' or not p.prosecdef)),
  null,
  'every write function runs as reachout_writer'
);

select ok(
  (select not rolbypassrls and not rolcanlogin and not rolsuper
   from pg_roles where rolname = 'reachout_writer'),
  'reachout_writer cannot sign in, and cannot bypass row-level security'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   where c.relnamespace = 'private'::regnamespace and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'private tables (credentials, undo history, rate limits) have row-level security too'
);

select ok(
  not has_table_privilege('authenticated', 'private.gmail_credentials', 'select')
    and not has_table_privilege('anon', 'private.gmail_credentials', 'select'),
  'Gmail credentials are never readable through the Data API'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
    and not has_schema_privilege('anon', 'private', 'usage'),
  'the private schema is closed to the Data API'
);

-- Two users, straight in SQL: each sees only their own workspace.
insert into auth.users (id, email, aud, role, instance_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@reachout.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@reachout.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","email":"b@reachout.test","role":"authenticated"}', true);
select public.bootstrap_account('B', 'UTC', '2026-10-06T09:00:00Z');
select public.complete_onboarding(jsonb_build_object(
  'goals', jsonb_build_object('objective', 'internship', 'target_roles', jsonb_build_array('Research'),
    'target_sectors', jsonb_build_array('Health'), 'target_locations', jsonb_build_array('Leeds')),
  'companies', jsonb_build_array(jsonb_build_object('id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'name', 'Orbis Health', 'created_at', '2026-10-06T09:00:00Z', 'updated_at', '2026-10-06T09:00:00Z')),
  'people', jsonb_build_array(jsonb_build_object('id', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'name', 'Dr Mei Lin', 'company_id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'source_kind', 'publication',
    'relationship_status', 'new', 'created_at', '2026-10-06T09:00:00Z', 'updated_at', '2026-10-06T09:00:00Z'))
), '2026-10-06T09:00:00Z');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"a@reachout.test","role":"authenticated"}', true);
select public.bootstrap_account('A', 'UTC', '2026-10-06T09:00:00Z');

select is(
  (select count(*)::int from public.people) + (select count(*)::int from public.companies),
  0,
  'A sees none of B''s people or companies'
);

select throws_ok(
  $$ select public.create_draft(jsonb_build_object('id', gen_random_uuid(),
       'person_id', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'channel', 'linkedin',
       'body', 'Planted', 'created_at', '2026-10-06T09:01:00Z')) $$,
  'P0001',
  'reachout.not_found',
  'A cannot write a draft to B''s person'
);

select throws_ok(
  $$ insert into public.people (id, workspace_id, name, role, source_kind, relationship_status, created_at, updated_at)
     values (gen_random_uuid(), (select id from public.workspaces), 'Direct', 'x', 'other', 'new', now(), now()) $$,
  '42501',
  null,
  'A cannot insert rows directly, even into A''s own workspace'
);

select throws_ok(
  $$ select public.save_profile('A', 'Mars/Olympus', null, null,
       (select updated_at from public.profiles), now()) $$,
  'P0001',
  'reachout.invalid',
  'a profile can only have a time zone Postgres knows'
);

select * from finish();
rollback;
