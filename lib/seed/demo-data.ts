import type { WineType, StorageLocationType } from '@/lib/types'

export const DEMO_STORAGE_LOCATIONS: { name: string; type: StorageLocationType }[] = [
  { name: 'Klimaschrank', type: 'climate_cabinet' },
  { name: 'Kühlschrank', type: 'fridge' },
]

export const DEMO_TRIP = {
  name: 'Toskana Mai 2026',
  location: 'Toscana, Italia',
  date_start: '2026-05-10',
  date_end: '2026-05-17',
}

export interface DemoWine {
  name: string
  producer: string
  vintage: number | null
  type: WineType
  region: string
  country: string
  grape_variety: string
  quantity: number
  purchase_price: number
  purchase_location: string
  storageLocationIndex: number
  tripIndex: number | null
  notes: string | null
  // Path within wine-photos bucket — shared across all demo cellars, never deleted per user
  demoPhotoPath: string
  tasting: { rating: number; notes: string } | null
}

export const DEMO_WINES: DemoWine[] = [
  {
    name: 'Brunello di Montalcino',
    producer: 'Casanova di Neri',
    vintage: 2018,
    type: 'red',
    region: 'Toskana',
    country: 'Italien',
    grape_variety: 'Sangiovese Grosso',
    quantity: 2,
    purchase_price: 48,
    purchase_location: 'Montalcino, Italia',
    storageLocationIndex: 0,
    tripIndex: 0,
    notes: 'Für besondere Anlässe — mindestens bis 2030 warten.',
    demoPhotoPath: 'demo/brunello.jpg',
    tasting: null,
  },
  {
    name: 'Barolo',
    producer: 'Giacomo Conterno',
    vintage: 2019,
    type: 'red',
    region: 'Piemonte',
    country: 'Italien',
    grape_variety: 'Nebbiolo',
    quantity: 3,
    purchase_price: 62,
    purchase_location: 'Barolo, Italia',
    storageLocationIndex: 0,
    tripIndex: null,
    notes: null,
    demoPhotoPath: 'demo/barolo.jpg',
    tasting: null,
  },
  {
    name: 'Pinot Grigio',
    producer: 'Santa Margherita',
    vintage: 2022,
    type: 'white',
    region: 'Alto Adige',
    country: 'Italien',
    grape_variety: 'Pinot Grigio',
    quantity: 4,
    purchase_price: 14,
    purchase_location: 'Online',
    storageLocationIndex: 1,
    tripIndex: null,
    notes: null,
    demoPhotoPath: 'demo/pinot-grigio.jpg',
    tasting: { rating: 7, notes: 'Leicht und mineralisch — gut zum Fisch.' },
  },
  {
    name: 'Prosecco Superiore DOCG',
    producer: 'Bisol',
    vintage: null,
    type: 'sparkling',
    region: 'Veneto',
    country: 'Italien',
    grape_variety: 'Glera',
    quantity: 6,
    purchase_price: 12,
    purchase_location: 'Weinhandlung Müller',
    storageLocationIndex: 1,
    tripIndex: null,
    notes: null,
    demoPhotoPath: 'demo/prosecco.jpg',
    tasting: { rating: 8, notes: 'Frisch und lebendig — perfekt als Aperitivo.' },
  },
  {
    name: 'Chianti Classico Riserva',
    producer: 'Antinori',
    vintage: 2020,
    type: 'red',
    region: 'Toskana',
    country: 'Italien',
    grape_variety: 'Sangiovese',
    quantity: 2,
    purchase_price: 28,
    purchase_location: 'Greve in Chianti, Italia',
    storageLocationIndex: 0,
    tripIndex: 0,
    notes: null,
    demoPhotoPath: 'demo/chianti.jpg',
    tasting: null,
  },
  {
    name: 'Rosé di Montepulciano',
    producer: 'Avignonesi',
    vintage: 2023,
    type: 'rosé',
    region: 'Toskana',
    country: 'Italien',
    grape_variety: 'Prugnolo Gentile',
    quantity: 2,
    purchase_price: 16,
    purchase_location: 'Montepulciano, Italia',
    storageLocationIndex: 1,
    tripIndex: 0,
    notes: null,
    demoPhotoPath: 'demo/rose.jpg',
    tasting: null,
  },
]
