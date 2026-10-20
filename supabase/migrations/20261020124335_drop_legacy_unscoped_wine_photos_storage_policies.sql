-- Resolves the CAVEAT noted in 20261020123319_wine_photos_rls_storage_and_advisories.sql:
-- once Supabase access was restored, querying pg_policies on storage.objects
-- confirmed two broad, out-of-band dashboard-created policies on the
-- wine-photos bucket were still live alongside the new family-scoped ones,
-- and (since permissive policies OR together) both undermined the fix:
--   - "authenticated users can upload wine photos" (INSERT, with_check:
--     bucket_id = 'wine-photos' AND auth.uid() IS NOT NULL) -- let ANY
--     authenticated user upload into ANY family's path, no scoping at all.
--   - "wine photos are publicly readable" (SELECT, qual: bucket_id =
--     'wine-photos', no path check) -- the actual public_bucket_allows_listing
--     vulnerability: a bare bucket-wide SELECT also permits listing every
--     object, not just fetching one by known path.
-- The bucket's `public: true` flag already allows anonymous GET-by-known-path
-- (Supabase's public-bucket behavior bypasses RLS for that specific access
-- pattern), so dropping "wine photos are publicly readable" does not break
-- lib/actions/wine-photos.ts's getPublicUrl() usage -- it only removes the
-- ability to list/enumerate the bucket's contents.
drop policy if exists "authenticated users can upload wine photos" on storage.objects;
drop policy if exists "wine photos are publicly readable" on storage.objects;
