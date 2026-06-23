-- Storage locations table
create table storage_locations (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  name text not null,
  type text not null check (type in ('fridge', 'cellar', 'climate_cabinet', 'other')),
  created_at timestamptz not null default now()
);

-- Add FK from cellar_entries to storage_locations
alter table cellar_entries
  add column storage_location_id uuid references storage_locations(id) on delete set null;

-- RLS
alter table storage_locations enable row level security;

create policy "family members can read and manage storage locations"
on storage_locations for all
using (
  exists (
    select 1 from cellars
    where cellars.id = storage_locations.cellar_id
    and is_family_member(cellars.family_id)
  )
);
