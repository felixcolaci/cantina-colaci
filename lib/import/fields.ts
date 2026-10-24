export type TargetField =
  | 'name' | 'producer' | 'type' | 'region' | 'country' | 'grape_variety' | 'notes'
  | 'vintage' | 'quantity' | 'purchase_price' | 'purchase_date' | 'purchase_location' | 'shelf_location'

// Index in die Rohzeile (ImportTable['rows'][i]), nicht der Spaltenname --
// erlaubt mehrdeutige/doppelte Headernamen in der Quelldatei.
export type ColumnMapping = Partial<Record<TargetField, number>>

export type TargetFieldConfig = {
  key: TargetField
  label: string
  required: boolean
  headerHints: string[]
}

// headerHints: lowercase, als Teilstring gegen den (lowercased) Spaltennamen
// geprüft -- siehe suggestMapping in parse-file.ts. Deutsch zuerst, dann
// gängige englische Varianten (häufigster Fall für Shop-Exporte).
export const TARGET_FIELDS: TargetFieldConfig[] = [
  { key: 'name', label: 'Name', required: true, headerHints: ['name', 'wein', 'wine'] },
  { key: 'producer', label: 'Produzent', required: true, headerHints: ['produzent', 'winzer', 'hersteller', 'producer', 'winery'] },
  { key: 'type', label: 'Typ', required: true, headerHints: ['typ', 'farbe', 'type', 'color', 'colour'] },
  { key: 'region', label: 'Region', required: false, headerHints: ['region'] },
  { key: 'country', label: 'Land', required: false, headerHints: ['land', 'country'] },
  { key: 'grape_variety', label: 'Rebsorte', required: false, headerHints: ['rebsorte', 'traube', 'grape', 'variety'] },
  { key: 'notes', label: 'Notizen', required: false, headerHints: ['notiz', 'notes', 'bemerkung'] },
  { key: 'vintage', label: 'Jahrgang', required: false, headerHints: ['jahrgang', 'jahr', 'vintage', 'year'] },
  { key: 'quantity', label: 'Anzahl', required: false, headerHints: ['anzahl', 'menge', 'stück', 'quantity', 'qty'] },
  { key: 'purchase_price', label: 'Preis', required: false, headerHints: ['preis', 'kaufpreis', 'price'] },
  { key: 'purchase_date', label: 'Kaufdatum', required: false, headerHints: ['kaufdatum', 'datum', 'date'] },
  { key: 'purchase_location', label: 'Kauforte', required: false, headerHints: ['händler', 'shop', 'kauforte', 'location'] },
  { key: 'shelf_location', label: 'Lagerort', required: false, headerHints: ['lagerort', 'regal', 'shelf'] },
]
