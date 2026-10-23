import { Schema, Table, column, AttachmentTable } from '@powersync/web'

// Mirrors the 10 streams in the self-hosted PowerSync instance's
// sync-config.yaml (`SELECT <table>.*` queries, scoped by auth.user_id()
// through family_members) -- keep both in sync when the Postgres schema
// changes. See supabase/migrations/001_initial_schema.sql for the source
// of truth on columns/types.
//
// wine_photos/discovery_photos carry no binary data -- just `path` (a bare
// Storage object key, same as skus.photo_path already does), same as every
// other column here. The actual photo bytes never go through PowerSync's
// CRUD sync; they travel over a separate AttachmentQueue remote transport
// (lib/powersync/attachment-queues.ts) that targets the Storage bucket
// directly through its own endpoints.

const families = new Table({
  name: column.text,
  created_by: column.text,
  created_at: column.text,
  plan: column.text,
  is_demo: column.integer,
})

const family_members = new Table({
  family_id: column.text,
  user_id: column.text,
  role: column.text,
  joined_at: column.text,
  display_name: column.text,
  theme_preference: column.text,
})

const cellars = new Table(
  {
    family_id: column.text,
    name: column.text,
    created_at: column.text,
  },
  { indexes: { family: ['family_id'] } }
)

const wines = new Table(
  {
    cellar_id: column.text,
    name: column.text,
    producer: column.text,
    vintage: column.integer,
    region: column.text,
    country: column.text,
    grape_variety: column.text,
    type: column.text,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { cellar: ['cellar_id'] } }
)

const skus = new Table(
  {
    wine_id: column.text,
    vintage: column.integer,
    quantity: column.integer,
    purchase_price: column.real,
    purchase_date: column.text,
    purchase_location: column.text,
    shelf_location: column.text,
    photo_path: column.text,
    trip_id: column.text,
    storage_location_id: column.text,
    status: column.text,
    created_at: column.text,
  },
  { indexes: { wine: ['wine_id'] } }
)

const storage_locations = new Table(
  {
    cellar_id: column.text,
    name: column.text,
    type: column.text,
    created_at: column.text,
  },
  { indexes: { cellar: ['cellar_id'] } }
)

const trips = new Table(
  {
    cellar_id: column.text,
    name: column.text,
    location: column.text,
    date_start: column.text,
    date_end: column.text,
    created_at: column.text,
  },
  { indexes: { cellar: ['cellar_id'] } }
)

const tastings = new Table(
  {
    cellar_entry_id: column.text,
    user_id: column.text,
    date: column.text,
    rating: column.integer,
    notes: column.text,
    created_at: column.text,
  },
  { indexes: { sku: ['cellar_entry_id'] } }
)

const discoveries = new Table(
  {
    cellar_id: column.text,
    created_by: column.text,
    name: column.text,
    producer: column.text,
    vintage: column.integer,
    type: column.text,
    location_text: column.text,
    trip_id: column.text,
    date: column.text,
    rating: column.integer,
    notes: column.text,
    price: column.real,
    created_at: column.text,
  },
  { indexes: { cellar: ['cellar_id'] } }
)

const wine_photos = new Table(
  {
    wine_id: column.text,
    path: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: { wine: ['wine_id'] } }
)

const discovery_photos = new Table(
  {
    discovery_id: column.text,
    path: column.text,
    created_at: column.text,
  },
  { indexes: { discovery: ['discovery_id'] } }
)

// Local-only bookkeeping tables for the two AttachmentQueues
// (lib/powersync/attachment-queues.ts) -- never synced, just tracks each
// queued photo upload's local state (QUEUED_UPLOAD/SYNCED/etc). One per
// queue (not the shared 'attachments' default) so a wine photo's row can
// never collide with a discovery photo's.
const wine_photo_attachments = new AttachmentTable({ viewName: 'wine_photo_attachments' })
const discovery_photo_attachments = new AttachmentTable({ viewName: 'discovery_photo_attachments' })

export const AppSchema = new Schema({
  families,
  family_members,
  cellars,
  wines,
  skus,
  storage_locations,
  trips,
  tastings,
  discoveries,
  wine_photos,
  discovery_photos,
  wine_photo_attachments,
  discovery_photo_attachments,
})

export type Database = (typeof AppSchema)['types']
