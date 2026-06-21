-- Families: top-level group (e.g. "Colaci", "Colaci Senior")
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Family members: many users per family
create table family_members (
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Cellars: belong to a family
create table cellars (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Trips: shopping trips (must be before cellar_entries for FK)
create table trips (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  name text not null,
  location text,
  date_start date,
  date_end date,
  created_at timestamptz not null default now()
);

-- Wines: the wine itself, independent of physical bottles
create table wines (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  name text not null,
  producer text not null,
  vintage int,
  region text,
  country text,
  grape_variety text,
  type text not null check (type in ('red', 'white', 'rosé', 'sparkling')),
  notes text,
  created_at timestamptz not null default now()
);

-- Cellar entries: physical bottles (one entry = one batch of bottles)
create table cellar_entries (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid not null references wines(id) on delete cascade,
  quantity int not null default 1 check (quantity >= 0),
  purchase_price numeric(10,2),
  purchase_date date,
  purchase_location text,
  shelf_location text,
  photo_url text,
  trip_id uuid references trips(id) on delete set null,
  status text not null default 'in_stock' check (status in ('in_stock', 'consumed', 'gifted')),
  created_at timestamptz not null default now()
);

-- Tastings: recorded when a bottle is opened
create table tastings (
  id uuid primary key default gen_random_uuid(),
  cellar_entry_id uuid not null references cellar_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  date date not null default current_date,
  rating int not null check (rating >= 1 and rating <= 10),
  notes text,
  created_at timestamptz not null default now()
);
