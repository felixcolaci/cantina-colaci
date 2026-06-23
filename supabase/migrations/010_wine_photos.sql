create table public.wine_photos (
  id            uuid        primary key default gen_random_uuid(),
  wine_id       uuid        not null references public.wines(id) on delete cascade,
  url           text        not null,
  sort_order    int         not null default 0,
  created_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.wine_photos to authenticated, service_role;
