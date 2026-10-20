-- Addresses the live Supabase advisor findings recorded in review-results.md
-- section 1.7a:
--
--   1. public.wine_photos has RLS disabled entirely (ERROR, rls_disabled_in_public)
--      despite a blanket grant to authenticated/service_role in
--      010_wine_photos.sql — any authenticated user could read/write/delete
--      any family's photo rows. Mirrors the wines/skus join-through-cellars
--      pattern used everywhere else in 002_rls_policies.sql.
--   2. The `wine-photos` storage bucket and its policies were created
--      out-of-band via the Supabase dashboard and are not defined in any
--      migration (zero hits for storage.objects/storage.buckets/wine-photos
--      under supabase/migrations/ before this file). This migration defines
--      the bucket and scoped storage.objects policies from scratch,
--      idempotently. The bucket stays `public` because
--      lib/actions/wine-photos.ts serves photos via getPublicUrl() (a
--      stable, already-known object path) — public buckets intentionally
--      skip RLS for *that* "fetch by known path" endpoint. What RLS on
--      storage.objects controls here is INSERT/UPDATE/DELETE (always
--      enforced) and authenticated LISTING (WARN, public_bucket_allows_listing),
--      which is why the SELECT policy below is scoped by path instead of a
--      bare `bucket_id = 'wine-photos'`.
--
--      CAVEAT: because this bucket/its policies were never captured in a
--      migration, we cannot know from this repo alone whether the dashboard
--      already created a broader pre-existing SELECT policy on
--      storage.objects for this bucket (e.g. one with no path scoping, which
--      is what the advisor flagged). Permissive RLS policies OR together, so
--      if such a policy still exists after this migration runs, listing
--      would still be possible despite the scoped policy added here. When
--      live access is restored, run:
--        select policyname, cmd, qual, with_check from pg_policies
--        where schemaname = 'storage' and tablename = 'objects';
--      and drop any remaining policy that references this bucket without a
--      storage.foldername(name) path check.
--   3. auth.uid() called bare (re-evaluated per row) in several
--      002_rls_policies.sql / 009_api_keys_rls.sql policies (WARN x6,
--      auth_rls_initplan on families/family_members/api_keys). Rewrapped as
--      (select auth.uid()) — logic unchanged, evaluated once per query.
--      NOTE: "users can join via invite" on family_members is intentionally
--      left untouched — a later stage rewrites the invite flow.
--   4. 9 foreign keys with no covering index (INFO x9, unindexed_foreign_keys).
--
-- Not in scope here (see review-results.md 1.7a "Explicitly NOT in scope"):
-- is_family_member() itself, and the "users can join via invite" policy.

-- =============================================================================
-- 1. Enable RLS on wine_photos + family-scoped policies
--    (mirrors "family members can read/insert/update/delete wines" in
--    002_rls_policies.sql, extended one hop further: wine_photos.wine_id ->
--    wines.cellar_id -> cellars.family_id -> is_family_member(...))
-- =============================================================================

alter table public.wine_photos enable row level security;

drop policy if exists "family members can read wine photos" on public.wine_photos;
drop policy if exists "family members can insert wine photos" on public.wine_photos;
drop policy if exists "family members can update wine photos" on public.wine_photos;
drop policy if exists "family members can delete wine photos" on public.wine_photos;

create policy "family members can read wine photos" on public.wine_photos
  for select using (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = wine_photos.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert wine photos" on public.wine_photos
  for insert with check (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = wine_photos.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can update wine photos" on public.wine_photos
  for update using (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = wine_photos.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  ) with check (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = wine_photos.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete wine photos" on public.wine_photos
  for delete using (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = wine_photos.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

-- =============================================================================
-- 2. wine-photos storage bucket + scoped storage.objects policies
--    Object paths are families/<family_id>/wines/<wine_id>/<uuid>.<ext>
--    (lib/actions/wine-photos.ts:48), so storage.foldername(name) yields
--    {'families', <family_id>, 'wines', <wine_id>} and segment [2] is the
--    family_id to check against is_family_member(...). Bucket stays public
--    (see header comment) — these policies govern INSERT/UPDATE/DELETE and
--    authenticated listing/SELECT, not the public getPublicUrl() fetch path.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('wine-photos', 'wine-photos', true)
on conflict (id) do nothing;

drop policy if exists "family members can read wine photo objects" on storage.objects;
drop policy if exists "family members can insert wine photo objects" on storage.objects;
drop policy if exists "family members can update wine photo objects" on storage.objects;
drop policy if exists "family members can delete wine photo objects" on storage.objects;

create policy "family members can read wine photo objects" on storage.objects
  for select using (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = 'families'
    and public.is_family_member(((storage.foldername(name))[2])::uuid)
  );

create policy "family members can insert wine photo objects" on storage.objects
  for insert with check (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = 'families'
    and public.is_family_member(((storage.foldername(name))[2])::uuid)
  );

create policy "family members can update wine photo objects" on storage.objects
  for update using (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = 'families'
    and public.is_family_member(((storage.foldername(name))[2])::uuid)
  ) with check (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = 'families'
    and public.is_family_member(((storage.foldername(name))[2])::uuid)
  );

create policy "family members can delete wine photo objects" on storage.objects
  for delete using (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = 'families'
    and public.is_family_member(((storage.foldername(name))[2])::uuid)
  );

-- =============================================================================
-- 3. Wrap bare auth.uid() as (select auth.uid()) in RLS policies
--    (auth_rls_initplan). Logic unchanged, only evaluation strategy. Skips
--    is_family_member() itself and "users can join via invite" per the
--    explicit scope exclusions above.
-- =============================================================================

-- families
alter policy "creator can update family" on families
  using (created_by = (select auth.uid()));

alter policy "authenticated users can create families" on families
  with check (created_by = (select auth.uid()));

-- family_members ("owner can manage members" only; "users can join via
-- invite" is intentionally left untouched)
alter policy "owner can manage members" on family_members
  using (
    exists (
      select 1 from families
      where families.id = family_members.family_id
      and families.created_by = (select auth.uid())
    )
  );

-- api_keys
alter policy "family owners can read their api keys" on public.api_keys
  using (
    exists (
      select 1 from family_members
      where family_members.family_id = api_keys.family_id
        and family_members.user_id = (select auth.uid())
        and family_members.role = 'owner'
    )
  );

alter policy "family owners can create api keys" on public.api_keys
  with check (
    exists (
      select 1 from family_members
      where family_members.family_id = api_keys.family_id
        and family_members.user_id = (select auth.uid())
        and family_members.role = 'owner'
    )
  );

alter policy "family owners can delete api keys" on public.api_keys
  using (
    exists (
      select 1 from family_members
      where family_members.family_id = api_keys.family_id
        and family_members.user_id = (select auth.uid())
        and family_members.role = 'owner'
    )
  );

-- =============================================================================
-- 4. Covering indexes for unindexed foreign keys (unindexed_foreign_keys x9)
-- =============================================================================

create index if not exists idx_cellars_family_id on public.cellars(family_id);
create index if not exists idx_wines_cellar_id on public.wines(cellar_id);
create index if not exists idx_skus_wine_id on public.skus(wine_id);
create index if not exists idx_tastings_cellar_entry_id on public.tastings(cellar_entry_id);
create index if not exists idx_tastings_user_id on public.tastings(user_id);
create index if not exists idx_trips_cellar_id on public.trips(cellar_id);
create index if not exists idx_storage_locations_cellar_id on public.storage_locations(cellar_id);
create index if not exists idx_wine_photos_wine_id on public.wine_photos(wine_id);
create index if not exists idx_api_keys_family_id on public.api_keys(family_id);
