-- wine_photos/discovery_photos metadata rows (path, sort_order, etc. -- not
-- the bytes, which travel over AttachmentQueue's own remote transport, see
-- lib/powersync/schema.ts) were never added to the powersync publication
-- when they were created, so uploads from one device never reached any
-- other device's local copy. schema.ts already documents them as a normal
-- synced stream -- this just makes Postgres match that.
alter publication powersync add table public.wine_photos;
alter publication powersync add table public.discovery_photos;

grant select on public.wine_photos, public.discovery_photos to powersync_replication;
