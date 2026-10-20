-- Converts the wine-photos bucket from public to private, closing the
-- residual gap that any photo URL, once obtained, stayed fetchable forever
-- by anyone unauthenticated (public-bucket GET bypasses RLS entirely by
-- design). From here on, every photo is resolved to a short-lived signed
-- URL at render time via the admin/service-role client, uniformly for both
-- real and demo photos (demo photos need no special-casing since signing
-- always bypasses RLS regardless of path).
--
-- Both columns currently hold a resolved public URL
-- (".../object/public/wine-photos/<path>"); rename + backfill to the bare
-- object path, since a signed URL must never be persisted (it expires).
alter table public.skus rename column photo_url to photo_path;
update public.skus
set photo_path = regexp_replace(photo_path, '^.*/object/public/wine-photos/', '')
where photo_path is not null;

alter table public.wine_photos rename column url to path;
update public.wine_photos
set path = regexp_replace(path, '^.*/object/public/wine-photos/', '');

update storage.buckets set public = false where id = 'wine-photos';
