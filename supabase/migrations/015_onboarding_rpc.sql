-- Atomically creates a family + owner membership + cellar for a user who
-- has none yet. Idempotent: if the user already has a family, returns
-- their existing family/cellar instead of creating a duplicate (guards
-- against double-submit or a stale /onboarding page revisit).
create or replace function public.create_family_and_cellar(
  p_user_id uuid,
  p_family_name text,
  p_cellar_name text
)
returns table (family_id uuid, cellar_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_cellar_id uuid;
begin
  select fm.family_id into v_family_id
  from public.family_members fm
  where fm.user_id = p_user_id
  limit 1;

  if v_family_id is not null then
    select c.id into v_cellar_id
    from public.cellars c
    where c.family_id = v_family_id
    order by c.created_at
    limit 1;
    return query select v_family_id, v_cellar_id;
    return;
  end if;

  insert into public.families (name, created_by)
  values (p_family_name, p_user_id)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (v_family_id, p_user_id, 'owner');

  insert into public.cellars (family_id, name)
  values (v_family_id, p_cellar_name)
  returning id into v_cellar_id;

  return query select v_family_id, v_cellar_id;
end;
$$;

revoke execute on function public.create_family_and_cellar(uuid, text, text) from public;
grant execute on function public.create_family_and_cellar(uuid, text, text) to service_role;
