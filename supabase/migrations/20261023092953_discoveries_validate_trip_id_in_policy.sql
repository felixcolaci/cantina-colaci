-- The insert/update policies on discoveries only validated cellar_id,
-- never trip_id -- a family member could link a discovery to a trip_id
-- from an entirely different family's cellar by writing directly to
-- PostgREST (bypassing the app-layer check in
-- app/api/v1/discoveries/[id]/route.ts, which only applies to writes
-- that go through the app's own API). Mirrors that same app-layer check
-- at the DB level: trip_id, if set, must belong to the same cellar_id.
drop policy "family members can insert discoveries" on public.discoveries;
drop policy "family members can update discoveries" on public.discoveries;

create policy "family members can insert discoveries" on public.discoveries
  for insert with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
    and (
      discoveries.trip_id is null
      or exists (
        select 1 from public.trips
        where public.trips.id = discoveries.trip_id
        and public.trips.cellar_id = discoveries.cellar_id
      )
    )
  );

create policy "family members can update discoveries" on public.discoveries
  for update using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  ) with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
    and (
      discoveries.trip_id is null
      or exists (
        select 1 from public.trips
        where public.trips.id = discoveries.trip_id
        and public.trips.cellar_id = discoveries.cellar_id
      )
    )
  );
