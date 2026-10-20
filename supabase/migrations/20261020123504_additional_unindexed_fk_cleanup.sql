-- A handful of unindexed-FK advisor findings the original review's "9" count
-- missed (confirmed via get_advisors after the main index migration landed):
-- families.created_by, family_members.user_id, skus.storage_location_id,
-- skus.trip_id, plus two brand-new ones from this session's family_invites
-- table. Purely additive, same pattern as idx_cellars_family_id etc.
create index if not exists idx_families_created_by on public.families(created_by);
create index if not exists idx_family_members_user_id on public.family_members(user_id);
create index if not exists idx_skus_storage_location_id on public.skus(storage_location_id);
create index if not exists idx_skus_trip_id on public.skus(trip_id);
create index if not exists idx_family_invites_created_by on public.family_invites(created_by);
create index if not exists idx_family_invites_used_by on public.family_invites(used_by);
