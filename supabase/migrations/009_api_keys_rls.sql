alter table public.api_keys enable row level security;

create policy "family owners can read their api keys"
on public.api_keys for select
using (
  exists (
    select 1 from family_members
    where family_members.family_id = api_keys.family_id
      and family_members.user_id = auth.uid()
      and family_members.role = 'owner'
  )
);

create policy "family owners can create api keys"
on public.api_keys for insert
with check (
  exists (
    select 1 from family_members
    where family_members.family_id = api_keys.family_id
      and family_members.user_id = auth.uid()
      and family_members.role = 'owner'
  )
);

create policy "family owners can delete api keys"
on public.api_keys for delete
using (
  exists (
    select 1 from family_members
    where family_members.family_id = api_keys.family_id
      and family_members.user_id = auth.uid()
      and family_members.role = 'owner'
  )
);
