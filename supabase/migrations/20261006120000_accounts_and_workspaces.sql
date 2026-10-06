-- Accounts and workspaces.
--
-- A profile is the product's User (DOMAIN.md › User): sign-in identity stays
-- with Supabase Auth. Every record a user keeps lives in a workspace, and
-- access is decided by workspace membership. V1 gives every account exactly
-- one personal workspace with one member; sharing is not a V1 feature
-- (PRODUCT.md › Non-goals), but isolation already rests on membership (D-025).

create schema if not exists private;
revoke all on schema private from public;
comment on schema private is
  'Reachout internals: access helpers and undo history. Never exposed through the Data API.';

-- Writes never come straight from the Data API. Every write is one of a few
-- explicit functions (see the workflow migration), and those functions run as
-- this role: it can write, it cannot bypass row-level security, and nobody can
-- sign in as it.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'reachout_writer') then
    create role reachout_writer nologin noinherit nobypassrls;
  end if;
end
$$;
comment on role reachout_writer is
  'Owns Reachout''s write functions. No login, no RLS bypass: RLS applies to every write.';

grant reachout_writer to postgres;
grant usage on schema public to reachout_writer;
grant usage on schema private to reachout_writer;

/* ——— Helpers ——— */

-- A non-empty list of non-blank labels (goals' roles, sectors, places).
create function private.is_label_list(labels text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(labels) >= 1
     and coalesce((select bool_and(btrim(label) <> '') from unnest(labels) as label), false)
$$;

-- The signed-in user, from the verified JWT. Wrapped so the writer role does
-- not need access to the auth schema.
create function private.uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
$$;

-- The signed-in user's email, from the verified JWT.
create function private.jwt_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select auth.jwt() ->> 'email'
$$;

/* ——— Profiles ——— */

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  email text not null check (position('@' in email) > 1),
  time_zone text not null check (btrim(time_zone) <> ''),
  education_institution text check (btrim(education_institution) <> ''),
  education_course text check (btrim(education_course) <> ''),
  education_graduation_year integer check (education_graduation_year between 1950 and 2100),
  goal_objective text check (
    goal_objective in ('internship', 'graduate_role', 'startup_role', 'research', 'mentorship', 'other')
  ),
  goal_target_roles text[] check (private.is_label_list(goal_target_roles)),
  goal_target_sectors text[] check (private.is_label_list(goal_target_sectors)),
  goal_target_locations text[] check (private.is_label_list(goal_target_locations)),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint profiles_education_complete check (
    num_nonnulls(education_institution, education_course, education_graduation_year) in (0, 3)
  ),
  constraint profiles_goals_complete check (
    num_nonnulls(goal_objective, goal_target_roles, goal_target_sectors, goal_target_locations) in (0, 4)
  ),
  constraint profiles_onboarding_needs_goals check (
    onboarding_completed_at is null or goal_objective is not null
  )
);
comment on table public.profiles is
  'The product profile of a signed-in account (DOMAIN.md › User). Email mirrors the sign-in address.';

-- Today is computed in this zone, so it must be one Postgres (and IANA) knows.
create function private.check_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.time_zone;
  return new;
exception
  when invalid_parameter_value then
    raise exception using errcode = 'P0001', message = 'reachout.invalid';
end
$$;
revoke all on function private.check_time_zone() from public;

create trigger profiles_time_zone_is_known
  before insert or update of time_zone on public.profiles
  for each row execute function private.check_time_zone();

/* ——— Workspaces and membership ——— */

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null,
  constraint workspaces_one_per_owner unique (owner_id)
);
comment on table public.workspaces is
  'Where a user''s records live. V1: exactly one personal workspace per account.';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null,
  primary key (workspace_id, profile_id)
);
create index workspace_members_profile_idx on public.workspace_members (profile_id);
comment on table public.workspace_members is
  'Who may use a workspace. Every row-level policy on user data checks this table.';

-- The workspaces the signed-in user belongs to. Security definer so policies
-- can consult membership without recursing into its own policy.
create function private.member_workspaces()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id from public.workspace_members m where m.profile_id = auth.uid()
$$;

-- The signed-in user's personal workspace, for writes that create records.
create function private.current_workspace()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select w.id into found_id
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where w.owner_id = auth.uid() and m.profile_id = auth.uid();
  if found_id is null then
    raise exception using errcode = 'P0001', message = 'reachout.no_workspace';
  end if;
  return found_id;
end
$$;

revoke all on function private.is_label_list(text[]) from public;
revoke all on function private.uid() from public;
revoke all on function private.jwt_email() from public;
revoke all on function private.member_workspaces() from public;
revoke all on function private.current_workspace() from public;
grant execute on function private.is_label_list(text[]) to authenticated, reachout_writer;
grant execute on function private.uid() to authenticated, reachout_writer;
grant execute on function private.jwt_email() to reachout_writer;
grant execute on function private.member_workspaces() to authenticated, reachout_writer;
grant execute on function private.current_workspace() to reachout_writer;

/* ——— Access ——— */

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "You can read your own profile"
  on public.profiles for select to authenticated, reachout_writer
  using (id = (select private.uid()));
create policy "Writes change only your own profile"
  on public.profiles for all to reachout_writer
  using (id = (select private.uid()))
  with check (id = (select private.uid()));

create policy "Members can read their workspaces"
  on public.workspaces for select to authenticated, reachout_writer
  using (id in (select private.member_workspaces()) or owner_id = (select private.uid()));
create policy "You can create only your own workspace"
  on public.workspaces for insert to reachout_writer
  with check (owner_id = (select private.uid()));

create policy "Members can read their workspaces' members"
  on public.workspace_members for select to authenticated, reachout_writer
  using (profile_id = (select private.uid()) or workspace_id in (select private.member_workspaces()));
create policy "You can join only a workspace you own"
  on public.workspace_members for insert to reachout_writer
  with check (
    profile_id = (select private.uid())
    and workspace_id in (select w.id from public.workspaces w where w.owner_id = (select private.uid()))
  );

-- The Data API may read (and RLS decides what); it may never write.
revoke all on public.profiles, public.workspaces, public.workspace_members from public, anon, authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant select, insert, update on public.profiles to reachout_writer;
grant select, insert on public.workspaces, public.workspace_members to reachout_writer;
