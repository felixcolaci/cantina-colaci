-- Grant table access to authenticated role (needed for PostgREST with user JWT)
grant select, insert, update, delete on public.families         to authenticated;
grant select, insert, update, delete on public.family_members   to authenticated;
grant select, insert, update, delete on public.cellars          to authenticated;
grant select, insert, update, delete on public.wines            to authenticated;
grant select, insert, update, delete on public.cellar_entries   to authenticated;
grant select, insert, update, delete on public.tastings         to authenticated;
grant select, insert, update, delete on public.trips            to authenticated;

-- Grant table access to service_role (needed for admin client used by server actions)
grant select, insert, update, delete on public.families         to service_role;
grant select, insert, update, delete on public.family_members   to service_role;
grant select, insert, update, delete on public.cellars          to service_role;
grant select, insert, update, delete on public.wines            to service_role;
grant select, insert, update, delete on public.cellar_entries   to service_role;
grant select, insert, update, delete on public.tastings         to service_role;
grant select, insert, update, delete on public.trips            to service_role;

grant usage on schema public to authenticated, service_role;

grant execute on function public.is_family_member(uuid) to service_role;
