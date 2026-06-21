-- Helper: check if the current user is a member of a given family
create or replace function is_family_member(fid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from family_members
    where family_members.family_id = fid
    and family_members.user_id = auth.uid()
  );
$$;

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
create policy "family members can read and manage wines" on wines
  for all using (
    exists (
      select 1 from cellars
      where cellars.id = wines.cellar_id
      and is_family_member(cellars.family_id)
    )
  );

-- Cellar entries
create policy "family members can read and manage entries" on cellar_entries
  for all using (
    exists (
      select 1 from wines
      join cellars on cellars.id = wines.cellar_id
      where wines.id = cellar_entries.wine_id
      and is_family_member(cellars.family_id)
    )
  );

-- Tastings
create policy "family members can read and manage tastings" on tastings
  for all using (
    exists (
      select 1 from cellar_entries
      join wines on wines.id = cellar_entries.wine_id
      join cellars on cellars.id = wines.cellar_id
      where cellar_entries.id = tastings.cellar_entry_id
      and is_family_member(cellars.family_id)
    )
  );

-- Trips
create policy "family members can read and manage trips" on trips
  for all using (
    exists (
      select 1 from cellars
      where cellars.id = trips.cellar_id
      and is_family_member(cellars.family_id)
    )
  );
