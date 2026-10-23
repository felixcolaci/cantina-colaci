-- Dedicated role for the self-hosted PowerSync replication connection.
-- BYPASSRLS is required by PowerSync's logical-replication read path (it
-- reads the WAL directly, which RLS cannot filter) -- see sync_rules.yaml
-- for the actual per-family authorization boundary that replaces RLS here.
create role powersync_replication with login replication bypassrls;

grant usage on schema public to powersync_replication;

grant select on
  public.families,
  public.family_members,
  public.cellars,
  public.trips,
  public.wines,
  public.skus,
  public.tastings,
  public.storage_locations
to powersync_replication;

-- Explicit table list (not FOR ALL TABLES): wine_photos, api_keys,
-- api_usage_logs, invitation_codes, family_invites and idempotency_keys are
-- deliberately excluded from sync.
create publication powersync for table
  public.families,
  public.family_members,
  public.cellars,
  public.trips,
  public.wines,
  public.skus,
  public.tastings,
  public.storage_locations;
