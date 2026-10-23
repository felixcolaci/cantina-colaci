-- Entdeckungen: Weine außerhalb des Kellerbestands, cellar-gescoped wie trips.
create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references public.cellars(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  producer text,
  vintage int,
  type text check (type in ('red', 'white', 'rosé', 'sparkling')),
  location_text text,
  trip_id uuid references public.trips(id) on delete set null,
  date date not null default current_date,
  rating int check (rating >= 1 and rating <= 5),
  notes text,
  price numeric(10,2),
  created_at timestamptz not null default now()
);

-- Höchstens ein Foto pro Entdeckung (unique auf discovery_id) -- analog
-- wine_photos, aber singulär statt Galerie.
create table public.discovery_photos (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null unique references public.discoveries(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.discoveries to authenticated, service_role;
grant select, insert, delete on public.discovery_photos to authenticated, service_role;

alter table public.discoveries enable row level security;
alter table public.discovery_photos enable row level security;

-- Kein update-Grant/-Policy: kein Edit in v1.

create policy "family members can read discoveries" on public.discoveries
  for select using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert discoveries" on public.discoveries
  for insert with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete discoveries" on public.discoveries
  for delete using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can read discovery photos" on public.discovery_photos
  for select using (
    exists (
      select 1 from public.discoveries
      join public.cellars on public.cellars.id = public.discoveries.cellar_id
      where public.discoveries.id = discovery_photos.discovery_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert discovery photos" on public.discovery_photos
  for insert with check (
    exists (
      select 1 from public.discoveries
      join public.cellars on public.cellars.id = public.discoveries.cellar_id
      where public.discoveries.id = discovery_photos.discovery_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete discovery photos" on public.discovery_photos
  for delete using (
    exists (
      select 1 from public.discoveries
      join public.cellars on public.cellars.id = public.discoveries.cellar_id
      where public.discoveries.id = discovery_photos.discovery_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create index if not exists idx_discoveries_cellar_id on public.discoveries(cellar_id);
create index if not exists idx_discoveries_trip_id on public.discoveries(trip_id);
create index if not exists idx_discoveries_created_by on public.discoveries(created_by);
create index if not exists idx_discovery_photos_discovery_id on public.discovery_photos(discovery_id);
