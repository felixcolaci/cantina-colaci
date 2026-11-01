-- Per-user light/dark/system UI preference, synced the same way as
-- display_name (see 20261021092606_family_members_surrogate_id.sql and
-- app/app/edit-name-sheet.tsx for the established local-first UPDATE
-- pattern). Defaults to 'system' so existing rows resolve to the OS/
-- browser preference until a user explicitly picks light or dark.
alter table public.family_members
  add column theme_preference text not null default 'system'
  check (theme_preference in ('light', 'dark', 'system'));
