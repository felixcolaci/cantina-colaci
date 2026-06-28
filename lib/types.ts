export type WineType = 'red' | 'white' | 'rosé' | 'sparkling'
export type EntryStatus = 'in_stock' | 'consumed' | 'gifted'
export type FamilyRole = 'owner' | 'member'

export interface Family {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface FamilyMember {
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
}

export interface Cellar {
  id: string
  family_id: string
  name: string
  created_at: string
}

export interface Wine {
  id: string
  cellar_id: string
  name: string
  producer: string
  region: string | null
  country: string | null
  grape_variety: string | null
  type: WineType
  notes: string | null
  created_at: string
}

export interface Sku {
  id: string
  wine_id: string
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  photo_url: string | null
  trip_id: string | null
  status: EntryStatus
  created_at: string
}

export interface Tasting {
  id: string
  cellar_entry_id: string
  user_id: string
  date: string
  rating: number
  notes: string | null
  created_at: string
}

export interface Trip {
  id: string
  cellar_id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
  created_at: string
}

export type StorageLocationType = 'fridge' | 'cellar' | 'climate_cabinet' | 'other'

export interface StorageLocation {
  id: string
  cellar_id: string
  name: string
  type: StorageLocationType
  created_at: string
}

export interface ApiKey {
  id: string
  family_id: string
  name: string
  key_hash: string
  created_at: string
}

export interface WineHints {
  names: string[]
  producers: string[]
  grapeVarieties: string[]
  purchaseLocations: string[]
  ownRegionsByCountry: Record<string, string[]>
  ownCountries: string[]
}
