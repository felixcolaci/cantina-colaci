-- Add plan to families
alter table families
  add column plan text not null default 'free'
  check (plan in ('free', 'pro', 'business'));

-- Per-family flag overrides
create table feature_flag_overrides (
  family_id uuid not null references families(id) on delete cascade,
  flag text not null,
  enabled boolean not null,
  created_at timestamptz not null default now(),
  primary key (family_id, flag)
);

-- Only family members can read their own overrides
alter table feature_flag_overrides enable row level security;

create policy "family members can read their overrides"
on feature_flag_overrides for select
using (is_family_member(family_id));
