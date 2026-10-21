-- PowerSync's client-side row model requires every synced row to be
-- addressable by a single `id` column. family_members only has a composite
-- PK (family_id, user_id) -- see 001_initial_schema.sql. This is purely
-- additive: the existing PK and FKs are untouched, nothing else changes.
alter table public.family_members add column id uuid not null default gen_random_uuid();
create unique index family_members_id_key on public.family_members(id);
