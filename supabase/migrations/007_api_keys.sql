create table api_keys (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);
