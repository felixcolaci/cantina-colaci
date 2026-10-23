-- Entdeckungen sind jetzt editierbar (siehe DiscoveryEditSheet) -- die
-- ursprüngliche Migration (add_discoveries_and_photos) hatte bewusst
-- keinen update-Grant/-Policy, weil Edit damals noch nicht in v1 war.
-- discovery_photos bleibt unverändert: ein Foto wird ersetzt (delete+insert),
-- nie in-place aktualisiert.
grant update on public.discoveries to authenticated, service_role;

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
  );
