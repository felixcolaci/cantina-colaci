-- Separates "opening a bottle" from "rating it" (docs/specs/open-rate-separation.md):
-- the open action no longer bundles a mandatory tasting insert, so it needs
-- its own trace of who opened a sku to scope personal "please rate this"
-- reminders. Nullable and never backfilled -- pre-existing consumed rows
-- already got a mandatory tasting under the old coupled flow, so there's no
-- legitimate "opened but unrated" backlog among them to represent here.
-- `on delete set null` mirrors current_cellar_id's FK above: a deleted
-- user account shouldn't block deleting their sku.
alter table public.skus
  add column opened_by uuid references auth.users(id) on delete set null;
