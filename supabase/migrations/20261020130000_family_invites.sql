-- Replaces the permanent, unrevocable "?family=<family_id>" invite link
-- (review-results.md finding 1.1, BLOCKER) with expiring, single-use invite
-- tokens.
--
-- Previously, app/(auth)/join/page.tsx inserted any logged-in user into
-- family_members for any family_id they happened to know, with no
-- invitation-code check at all. The DB enforced the same lack of
-- restriction via the "users can join via invite" policy below
-- (with check (user_id = auth.uid()) only — no reference to any invite).
--
-- This migration:
--   1. Adds a family_invites table holding random, expiring, single-use
--      tokens.
--   2. Adds two SECURITY DEFINER RPCs, create_family_invite and
--      redeem_family_invite, that mint and redeem those tokens.
--   3. Drops the old "users can join via invite" policy on family_members,
--      since joining now only happens through redeem_family_invite (which
--      is SECURITY DEFINER and so bypasses RLS for its own insert). This
--      also resolves the multiple_permissive_policies advisor finding noted
--      in review-results.md 1.7a for family_members INSERT — only
--      "owner can manage members" remains for INSERT afterwards.
--
-- Client choice: like create_family_and_cellar (015_onboarding_rpc.sql) and
-- get_cellar_context (014_cellar_context_rpc.sql), both new functions take
-- the caller's user id as an explicit p_user_id parameter instead of
-- reading auth.uid() internally, and are granted to service_role only (not
-- authenticated) — matching this codebase's established, deliberate
-- convention for SECURITY DEFINER RPCs, documented in
-- lib/supabase/server.ts's comment on createAdminClient(): this project's
-- Supabase Auth setup causes auth.uid() to return NULL for requests made
-- through the plain session client, so RLS/auth.uid()-dependent logic
-- cannot be trusted to run under that client (see also review-results.md
-- 2.2). Server actions call these RPCs via createAdminClient() after first
-- verifying the caller's identity with createClient()/getAuthenticatedUser().

-- =============================================================================
-- 1. family_invites table
-- =============================================================================

create table public.family_invites (
  token text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id)
);

alter table public.family_invites enable row level security;

-- Family members can see and create invites for their own family. Nothing
-- else: no update/delete policy exists for the plain client (only the
-- SECURITY DEFINER redeem_family_invite function, which runs as the table
-- owner and so bypasses RLS, marks an invite used), and no policy grants
-- any access to anon.
create policy "family members can read their family invites" on public.family_invites
  for select using (is_family_member(family_id));

create policy "family members can create invites for their family" on public.family_invites
  for insert with check (is_family_member(family_id));

grant select, insert on public.family_invites to authenticated, service_role;

create index idx_family_invites_family_id on public.family_invites(family_id);

-- =============================================================================
-- 2. create_family_invite — mints a token for a family the caller belongs to
-- =============================================================================

create or replace function public.create_family_invite(
  p_family_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from public.family_members
    where family_id = p_family_id
    and user_id = p_user_id
    and role = 'owner'
  ) then
    raise exception 'not_family_owner';
  end if;

  -- Two concatenated v4 UUIDs (dashes stripped), ~244 bits of randomness —
  -- unguessable, plain ASCII (safe to embed in a URL query param as-is),
  -- and built only from gen_random_uuid(), which is already used
  -- throughout this codebase (001_initial_schema.sql etc.) as a
  -- pg_catalog-native function (built into Postgres since v13 — no
  -- extension required). That matters here specifically because this
  -- function runs with `set search_path = ''`: gen_random_bytes() from
  -- pgcrypto would need schema-qualifying (and pgcrypto was never
  -- explicitly enabled by any migration in this repo), whereas
  -- gen_random_uuid() resolves via the always-implicit pg_catalog search
  -- path regardless.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.family_invites (token, family_id, created_by, expires_at)
  values (v_token, p_family_id, p_user_id, now() + interval '7 days');

  return v_token;
end;
$$;

revoke execute on function public.create_family_invite(uuid, uuid) from public;
grant execute on function public.create_family_invite(uuid, uuid) to service_role;

-- =============================================================================
-- 3. redeem_family_invite — validates a token and joins the caller to its
--    family. Idempotent against double-submit, same defensive style as
--    create_family_and_cellar (015_onboarding_rpc.sql): checks whether the
--    caller is already a member before inserting.
-- =============================================================================

create or replace function public.redeem_family_invite(
  p_token text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.family_invites;
begin
  select * into v_invite
  from public.family_invites
  where token = p_token;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.used_at is not null then
    raise exception 'invite_already_used';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  if not exists (
    select 1 from public.family_members
    where family_id = v_invite.family_id
    and user_id = p_user_id
  ) then
    insert into public.family_members (family_id, user_id, role)
    values (v_invite.family_id, p_user_id, 'member');
  end if;

  update public.family_invites
  set used_at = now(), used_by = p_user_id
  where token = p_token;

  return v_invite.family_id;
end;
$$;

revoke execute on function public.redeem_family_invite(text, uuid) from public;
grant execute on function public.redeem_family_invite(text, uuid) to service_role;

-- =============================================================================
-- 4. Drop the old, unrestricted self-insert policy on family_members.
--    Joining a family now only happens via redeem_family_invite above.
-- =============================================================================

drop policy if exists "users can join via invite" on public.family_members;
