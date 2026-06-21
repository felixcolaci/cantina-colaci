-- Helper: check if the current user is a member of a given family
create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where public.family_members.family_id = fid
    and public.family_members.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_family_member(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;

-- Enable RLS on all tables
alter table families enable row level security;
alter table family_members enable row level security;
alter table cellars enable row level security;
alter table wines enable row level security;
alter table cellar_entries enable row level security;
alter table tastings enable row level security;
alter table trips enable row level security;

-- Families
create policy "members can read their family" on families
  for select using (is_family_member(id));
create policy "creator can update family" on families
  for update using (created_by = auth.uid());
create policy "authenticated users can create families" on families
  for insert with check (created_by = auth.uid());

-- Family members
create policy "members can read family membership" on family_members
  for select using (is_family_member(family_id));
create policy "owner can manage members" on family_members
  for all using (
    exists (
      select 1 from families
      where families.id = family_members.family_id
      and families.created_by = auth.uid()
    )
  );
create policy "users can join via invite" on family_members
  for insert with check (user_id = auth.uid());

-- Cellars
create policy "family members can read and manage cellars" on cellars
  for all using (is_family_member(family_id));

-- Wines
create policy "family members can read wines" on wines
  for select using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = wines.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert wines" on wines
  for insert with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = wines.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can update wines" on wines
  for update using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = wines.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  ) with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = wines.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete wines" on wines
  for delete using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = wines.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

-- Cellar entries
create policy "family members can read entries" on cellar_entries
  for select using (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = cellar_entries.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert entries" on cellar_entries
  for insert with check (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = cellar_entries.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can update entries" on cellar_entries
  for update using (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = cellar_entries.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  ) with check (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = cellar_entries.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete entries" on cellar_entries
  for delete using (
    exists (
      select 1 from public.wines
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.wines.id = cellar_entries.wine_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

-- Tastings
create policy "family members can read tastings" on tastings
  for select using (
    exists (
      select 1 from public.cellar_entries
      join public.wines on public.wines.id = public.cellar_entries.wine_id
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.cellar_entries.id = tastings.cellar_entry_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert tastings" on tastings
  for insert with check (
    exists (
      select 1 from public.cellar_entries
      join public.wines on public.wines.id = public.cellar_entries.wine_id
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.cellar_entries.id = tastings.cellar_entry_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can update tastings" on tastings
  for update using (
    exists (
      select 1 from public.cellar_entries
      join public.wines on public.wines.id = public.cellar_entries.wine_id
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.cellar_entries.id = tastings.cellar_entry_id
      and public.is_family_member(public.cellars.family_id)
    )
  ) with check (
    exists (
      select 1 from public.cellar_entries
      join public.wines on public.wines.id = public.cellar_entries.wine_id
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.cellar_entries.id = tastings.cellar_entry_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete tastings" on tastings
  for delete using (
    exists (
      select 1 from public.cellar_entries
      join public.wines on public.wines.id = public.cellar_entries.wine_id
      join public.cellars on public.cellars.id = public.wines.cellar_id
      where public.cellar_entries.id = tastings.cellar_entry_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

-- Trips
create policy "family members can read trips" on trips
  for select using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = trips.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert trips" on trips
  for insert with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = trips.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can update trips" on trips
  for update using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = trips.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  ) with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = trips.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete trips" on trips
  for delete using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = trips.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );
