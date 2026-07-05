-- Collapses the family_members -> cellars lookup (previously two sequential
-- REST round trips, repeated on nearly every page) into one RPC call.
create or replace function public.get_cellar_context(p_user_id uuid)
returns table (family_id uuid, cellar_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select fm.family_id, c.id as cellar_id
  from public.family_members fm
  left join public.cellars c on c.family_id = fm.family_id
  where fm.user_id = p_user_id
  order by c.created_at asc
  limit 1;
$$;

revoke execute on function public.get_cellar_context(uuid) from public;
grant execute on function public.get_cellar_context(uuid) to authenticated, service_role;
