import { Schema, Table, column } from '@powersync/web'

// Mirrors the 8 streams in the self-hosted PowerSync instance's
// sync-config.yaml (`SELECT <table>.*` queries, scoped by auth.user_id()
// through family_members) -- keep both in sync when the Postgres schema
// changes. See supabase/migrations/001_initial_schema.sql for the source
// of truth on columns/types.

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

export const AppSchema = new Schema({
  families,
  family_members,
  cellars,
  wines,
  skus,
  storage_locations,
  trips,
  tastings,
})

export type Database = (typeof AppSchema)['types']
