-- Per-user active cellar selection, synced the same way as display_name/
-- theme_preference (see 20261023150000_family_members_theme_preference.sql)
-- -- lets each family member pick which of their family's cellars they're
-- currently viewing, independent of what other members have selected.
-- NULL means "no explicit choice yet" (new member, or one who never
-- switched), so get_cellar_context below falls back to the family's
-- oldest cellar, same resolution it always used before this column
-- existed. `on delete set null` also covers the deleted-cellar case: if a
-- member's chosen cellar is removed, their selection just reverts to that
-- same fallback instead of dangling.
alter table public.family_members
  add column current_cellar_id uuid references public.cellars(id) on delete set null;

-- Re-points get_cellar_context at the member's own current_cellar_id when
-- it's set, instead of always resolving to the family's oldest cellar.
-- Falls back to the oldest cellar when current_cellar_id is NULL, or (as
-- a defensive belt-and-suspenders check -- the FK's `on delete set null`
-- above already prevents this in practice) when it doesn't resolve to a
-- cellar in the member's own family.
create or replace function public.get_cellar_context(p_user_id uuid)
returns table (family_id uuid, cellar_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select
    fm.family_id,
    coalesce(
      (select c.id from public.cellars c where c.id = fm.current_cellar_id and c.family_id = fm.family_id),
      (select c.id from public.cellars c where c.family_id = fm.family_id order by c.created_at asc limit 1)
    ) as cellar_id
  from public.family_members fm
  where fm.user_id = p_user_id
$$;

revoke execute on function public.get_cellar_context(uuid) from public;
grant execute on function public.get_cellar_context(uuid) to service_role;
