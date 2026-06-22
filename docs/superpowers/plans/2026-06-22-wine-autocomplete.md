# Wine Form Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add as-you-type autocomplete to the wine entry form, with a dependent country→region combobox pair and hybrid static+own-data suggestions.

**Architecture:** A reusable `Combobox` component (shadcn Popover + Command) replaces plain Inputs for autocomplete fields. Static wine data lives in `lib/wine-data.ts`. The server page loads the user's own distinct values from Supabase and passes them as props — no client-side fetching.

**Tech Stack:** Next.js (App Router), shadcn/ui (Popover, Command), Radix UI, Vitest + @testing-library/react, Supabase

## Global Constraints

- UI language is German (labels, placeholders, empty states)
- No new external npm packages beyond shadcn components
- Server Action `addWine` must remain unchanged — form data is submitted via hidden inputs
- Combobox values are free-text (user is not forced to pick from the list)
- Static wine names use German spellings (e.g. "Toskana", "Piemont", "Burgund")

---

### Task 1: Static wine data

**Files:**
- Create: `lib/wine-data.ts`
- Create: `lib/__tests__/wine-data.test.ts`

**Interfaces:**
- Produces:
  - `WINE_COUNTRIES: string[]`
  - `WINE_REGIONS: Record<string, string[]>`
  - `GRAPE_VARIETIES: string[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/wine-data.test.ts
import { describe, it, expect } from 'vitest'
import { WINE_COUNTRIES, WINE_REGIONS, GRAPE_VARIETIES } from '../wine-data'

describe('WINE_COUNTRIES', () => {
  it('contains Italien', () => {
    expect(WINE_COUNTRIES).toContain('Italien')
  })
  it('contains Frankreich', () => {
    expect(WINE_COUNTRIES).toContain('Frankreich')
  })
  it('has at least 10 entries', () => {
    expect(WINE_COUNTRIES.length).toBeGreaterThanOrEqual(10)
  })
})

describe('WINE_REGIONS', () => {
  it('contains Italian regions under key "Italien"', () => {
    expect(WINE_REGIONS['Italien']).toContain('Toskana')
    expect(WINE_REGIONS['Italien']).toContain('Piemont')
    expect(WINE_REGIONS['Italien']).toContain('Venetien')
  })
  it('contains French regions under key "Frankreich"', () => {
    expect(WINE_REGIONS['Frankreich']).toContain('Bordeaux')
    expect(WINE_REGIONS['Frankreich']).toContain('Burgund')
  })
  it('every country in WINE_REGIONS exists in WINE_COUNTRIES', () => {
    for (const country of Object.keys(WINE_REGIONS)) {
      expect(WINE_COUNTRIES).toContain(country)
    }
  })
})

describe('GRAPE_VARIETIES', () => {
  it('contains Sangiovese', () => {
    expect(GRAPE_VARIETIES).toContain('Sangiovese')
  })
  it('contains Riesling', () => {
    expect(GRAPE_VARIETIES).toContain('Riesling')
  })
  it('has at least 20 entries', () => {
    expect(GRAPE_VARIETIES.length).toBeGreaterThanOrEqual(20)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/__tests__/wine-data.test.ts
```

Expected: FAIL — `Cannot find module '../wine-data'`

- [ ] **Step 3: Create the static data file**

```ts
// lib/wine-data.ts
export const WINE_COUNTRIES: string[] = [
  'Italien',
  'Frankreich',
  'Deutschland',
  'Spanien',
  'Portugal',
  'Österreich',
  'Schweiz',
  'USA',
  'Argentinien',
  'Chile',
  'Südafrika',
  'Australien',
  'Neuseeland',
  'Ungarn',
  'Griechenland',
  'Slowenien',
  'Kroatien',
]

export const WINE_REGIONS: Record<string, string[]> = {
  'Italien': [
    'Toskana',
    'Piemont',
    'Venetien',
    'Sizilien',
    'Kampanien',
    'Apulien',
    'Sardinien',
    'Friaul-Julisch Venetien',
    'Trentino-Südtirol',
    'Lombardei',
    'Umbrien',
    'Marken',
    'Latium',
    'Abruzzen',
    'Emilia-Romagna',
    'Ligurien',
    'Kalabrien',
    'Basilicata',
    'Molise',
  ],
  'Frankreich': [
    'Bordeaux',
    'Burgund',
    'Champagne',
    'Elsass',
    'Loire',
    'Rhônetal',
    'Provence',
    'Languedoc-Roussillon',
    'Beaujolais',
    'Südwestfrankreich',
    'Jura',
    'Savoyen',
  ],
  'Deutschland': [
    'Mosel',
    'Rheingau',
    'Rheinhessen',
    'Pfalz',
    'Baden',
    'Württemberg',
    'Franken',
    'Nahe',
    'Ahr',
    'Mittelrhein',
    'Sachsen',
    'Saale-Unstrut',
  ],
  'Spanien': [
    'Rioja',
    'Ribera del Duero',
    'Priorat',
    'Galicien',
    'Penedès',
    'Rías Baixas',
    'Jerez',
    'Toro',
    'Navarra',
    'Bierzo',
    'Rueda',
    'Jumilla',
  ],
  'Portugal': [
    'Douro',
    'Alentejo',
    'Vinho Verde',
    'Dão',
    'Bairrada',
    'Setúbal',
    'Algarve',
    'Lissabon',
  ],
  'Österreich': [
    'Wachau',
    'Kamptal',
    'Kremstal',
    'Weinviertel',
    'Burgenland',
    'Steiermark',
    'Wien',
    'Traisental',
    'Wagram',
  ],
  'USA': [
    'Napa Valley',
    'Sonoma County',
    'Willamette Valley',
    'Columbia Valley',
    'Paso Robles',
    'Santa Barbara County',
    'Finger Lakes',
  ],
  'Argentinien': [
    'Mendoza',
    'Salta',
    'San Juan',
    'Patagonien',
    'La Rioja',
  ],
  'Chile': [
    'Maipo',
    'Colchagua',
    'Casablanca',
    'Maule',
    'Aconcagua',
    'Elqui',
  ],
  'Südafrika': [
    'Stellenbosch',
    'Franschhoek',
    'Paarl',
    'Swartland',
    'Walker Bay',
  ],
  'Australien': [
    'Barossa Valley',
    'McLaren Vale',
    'Clare Valley',
    'Yarra Valley',
    'Margaret River',
    'Hunter Valley',
  ],
  'Neuseeland': [
    'Marlborough',
    'Hawke\'s Bay',
    'Central Otago',
  ],
  'Ungarn': [
    'Tokaj',
    'Eger',
    'Villány',
  ],
}

export const GRAPE_VARIETIES: string[] = [
  // Rot – Italienisch
  'Sangiovese',
  'Nebbiolo',
  'Barbera',
  'Dolcetto',
  'Montepulciano',
  'Primitivo',
  'Aglianico',
  'Nero d\'Avola',
  'Cannonau',
  'Corvina',
  'Nerello Mascalese',
  'Sagrantino',
  // Rot – International
  'Cabernet Sauvignon',
  'Merlot',
  'Syrah',
  'Grenache',
  'Tempranillo',
  'Malbec',
  'Pinot Noir',
  'Zinfandel',
  'Touriga Nacional',
  'Blaufränkisch',
  'Zweigelt',
  'Gamay',
  'Carignan',
  // Weiß – Italienisch
  'Vermentino',
  'Verdicchio',
  'Trebbiano',
  'Cortese',
  'Arneis',
  'Falanghina',
  'Fiano',
  'Greco di Tufo',
  'Pinot Grigio',
  'Garganega',
  'Catarratto',
  // Weiß – International
  'Riesling',
  'Chardonnay',
  'Sauvignon Blanc',
  'Grüner Veltliner',
  'Gewürztraminer',
  'Pinot Blanc',
  'Viognier',
  'Chenin Blanc',
  'Albariño',
  'Muscat',
  'Welschriesling',
  'Grauburgunder',
  'Weißburgunder',
]
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/__tests__/wine-data.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/wine-data.ts lib/__tests__/wine-data.test.ts
git commit -m "feat: add static wine countries, regions and grape varieties"
```

---

### Task 2: Install shadcn components & build Combobox

**Files:**
- Run: `npx shadcn add popover command` (generates `components/ui/popover.tsx` and `components/ui/command.tsx`)
- Create: `components/ui/combobox.tsx`
- Create: `lib/__tests__/combobox.test.tsx`

**Interfaces:**
- Consumes: `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`; `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList` from `@/components/ui/command`
- Produces:
  ```ts
  interface ComboboxProps {
    name: string
    value: string
    onChange: (value: string) => void
    options: string[]
    placeholder?: string
    disabled?: boolean
  }
  export function Combobox(props: ComboboxProps): JSX.Element
  ```

- [ ] **Step 1: Install shadcn Popover and Command**

```bash
npx shadcn add popover command
```

Expected: `components/ui/popover.tsx` and `components/ui/command.tsx` created. No errors.

- [ ] **Step 2: Write the failing tests**

```tsx
// lib/__tests__/combobox.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox } from '@/components/ui/combobox'

const OPTIONS = ['Toskana', 'Piemont', 'Venetien']

describe('Combobox', () => {
  it('renders a hidden input with the current value', () => {
    render(
      <Combobox name="region" value="Toskana" onChange={() => {}} options={OPTIONS} />
    )
    const hidden = document.querySelector('input[type="hidden"][name="region"]') as HTMLInputElement
    expect(hidden).not.toBeNull()
    expect(hidden.value).toBe('Toskana')
  })

  it('shows placeholder when value is empty', () => {
    render(
      <Combobox name="region" value="" onChange={() => {}} options={OPTIONS} placeholder="Region wählen" />
    )
    expect(screen.getByText('Region wählen')).toBeInTheDocument()
  })

  it('calls onChange when an option is selected', async () => {
    const onChange = vi.fn()
    render(
      <Combobox name="region" value="" onChange={onChange} options={OPTIONS} />
    )
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByText('Toskana'))
    expect(onChange).toHaveBeenCalledWith('Toskana')
  })

  it('is disabled when disabled prop is set', () => {
    render(
      <Combobox name="region" value="" onChange={() => {}} options={OPTIONS} disabled />
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run lib/__tests__/combobox.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/ui/combobox'`

- [ ] **Step 4: Create the Combobox component**

```tsx
// components/ui/combobox.tsx
'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ComboboxProps {
  name: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}

export function Combobox({
  name,
  value,
  onChange,
  options,
  placeholder = 'Auswählen oder eingeben…',
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  function handleSelect(selected: string) {
    onChange(selected)
    setSearch('')
    setOpen(false)
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && search.trim()) {
      onChange(search.trim())
      setSearch('')
    }
    setOpen(isOpen)
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {value || <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Suchen oder eingeben…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() && (
                  <button
                    type="button"
                    className="px-4 py-2 text-sm w-full text-left hover:bg-accent"
                    onClick={() => handleSelect(search.trim())}
                  >
                    „{search.trim()}" verwenden
                  </button>
                )}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run lib/__tests__/combobox.test.tsx
```

Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add components/ui/popover.tsx components/ui/command.tsx components/ui/combobox.tsx lib/__tests__/combobox.test.tsx
git commit -m "feat: add Combobox component with free-text and shadcn Command/Popover"
```

---

### Task 3: Load WineHints and wire up WineForm

**Files:**
- Modify: `lib/types.ts` — add `WineHints` interface
- Modify: `app/wine/new/page.tsx` — load hints from Supabase
- Modify: `app/wine/new/wine-form.tsx` — replace Inputs with Combobox, add country→region state

**Interfaces:**
- Consumes:
  - `Combobox` from `@/components/ui/combobox` (value, onChange, options, name, placeholder)
  - `WINE_COUNTRIES`, `WINE_REGIONS`, `GRAPE_VARIETIES` from `@/lib/wine-data`
  - `WineHints` from `@/lib/types`
- Produces: Updated `WineForm` with autocomplete fields; same FormData shape as before (no change to server action)

- [ ] **Step 1: Add WineHints type**

In `lib/types.ts`, append after the last `interface` definition:

```ts
export interface WineHints {
  names: string[]
  producers: string[]
  grapeVarieties: string[]
  purchaseLocations: string[]
  ownRegions: string[]
  ownCountries: string[]
}
```

- [ ] **Step 2: Update page.tsx to load hints**

Replace `app/wine/new/page.tsx` entirely with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineForm } from './wine-form'
import type { WineHints } from '@/lib/types'

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))]
}

export default async function NewWinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const cellarId = cellar?.id

  const [tripsResult, winesResult, wineIdsResult] = await Promise.all([
    cellarId
      ? supabase.from('trips').select('id, name').eq('cellar_id', cellarId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('wines').select('name, producer, grape_variety, region, country').eq('cellar_id', cellarId)
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('wines').select('id').eq('cellar_id', cellarId)
      : Promise.resolve({ data: [] }),
  ])

  const wines = winesResult.data ?? []
  const wineIds = (wineIdsResult.data ?? []).map((w: { id: string }) => w.id)

  const entriesResult = wineIds.length > 0
    ? await supabase.from('cellar_entries').select('purchase_location').in('wine_id', wineIds)
    : { data: [] }

  const hints: WineHints = {
    names: distinct(wines.map((w: { name: string }) => w.name)),
    producers: distinct(wines.map((w: { producer: string }) => w.producer)),
    grapeVarieties: distinct(wines.map((w: { grape_variety: string | null }) => w.grape_variety)),
    purchaseLocations: distinct((entriesResult.data ?? []).map((e: { purchase_location: string | null }) => e.purchase_location)),
    ownRegions: distinct(wines.map((w: { region: string | null }) => w.region)),
    ownCountries: distinct(wines.map((w: { country: string | null }) => w.country)),
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-6">Wein hinzufügen</h2>
      <WineForm trips={tripsResult.data ?? []} hints={hints} />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite wine-form.tsx with autocomplete**

Replace `app/wine/new/wine-form.tsx` entirely with:

```tsx
'use client'

import { useState } from 'react'
import { addWine } from '@/lib/actions/wine'
import { compressImage } from '@/lib/image-compress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { WINE_COUNTRIES, WINE_REGIONS, GRAPE_VARIETIES } from '@/lib/wine-data'
import type { Trip, WineHints } from '@/lib/types'

interface WineFormProps {
  trips: Pick<Trip, 'id' | 'name'>[]
  hints: WineHints
}

export function WineForm({ trips, hints }: WineFormProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [grapeVariety, setGrapeVariety] = useState('')
  const [purchaseLocation, setPurchaseLocation] = useState('')

  const countryOptions = [...new Set([...WINE_COUNTRIES, ...hints.ownCountries])]
  const regionOptions = [...new Set([
    ...(WINE_REGIONS[country] ?? []),
    ...hints.ownRegions,
  ])]

  function handleCountryChange(value: string) {
    setCountry(value)
    setRegion('')
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setCompressedFile(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(formData: FormData) {
    if (compressedFile) formData.set('photo', compressedFile)
    await addWine(formData)
  }

  return (
    <form action={handleSubmit} className="space-y-4 pb-8">
      <div className="space-y-2">
        <Label>Foto der Flasche</Label>
        {preview && (
          <img src={preview} alt="Vorschau" className="w-24 h-32 object-cover rounded border" />
        )}
        <Input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
      </div>

      <div className="space-y-2">
        <Label>Name *</Label>
        <Combobox
          name="name"
          value={name}
          onChange={setName}
          options={hints.names}
          placeholder="z.B. Barolo"
        />
      </div>

      <div className="space-y-2">
        <Label>Weingut / Hersteller *</Label>
        <Combobox
          name="producer"
          value={producer}
          onChange={setProducer}
          options={hints.producers}
          placeholder="z.B. Antinori"
        />
      </div>

      <div className="space-y-2">
        <Label>Weintyp *</Label>
        <Select name="type" required>
          <SelectTrigger><SelectValue placeholder="Typ auswählen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="red">Rotwein</SelectItem>
            <SelectItem value="white">Weißwein</SelectItem>
            <SelectItem value="rosé">Rosé</SelectItem>
            <SelectItem value="sparkling">Schaumwein</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="vintage">Jahrgang</Label>
          <Input id="vintage" name="vintage" type="number" min="1900" max="2099" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Flaschen</Label>
          <Input id="quantity" name="quantity" type="number" min="1" defaultValue="1" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Land</Label>
        <Combobox
          name="country"
          value={country}
          onChange={handleCountryChange}
          options={countryOptions}
          placeholder="z.B. Italien"
        />
      </div>

      <div className="space-y-2">
        <Label>Region</Label>
        <Combobox
          name="region"
          value={region}
          onChange={setRegion}
          options={regionOptions}
          placeholder="z.B. Toskana"
        />
      </div>

      <div className="space-y-2">
        <Label>Rebsorte</Label>
        <Combobox
          name="grape_variety"
          value={grapeVariety}
          onChange={setGrapeVariety}
          options={[...new Set([...GRAPE_VARIETIES, ...hints.grapeVarieties])]}
          placeholder="z.B. Sangiovese"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Preis (€)</Label>
          <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Kaufdatum</Label>
          <Input id="purchase_date" name="purchase_date" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Kaufort</Label>
        <Combobox
          name="purchase_location"
          value={purchaseLocation}
          onChange={setPurchaseLocation}
          options={hints.purchaseLocations}
          placeholder="z.B. Montalcino"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shelf_location">Position im Keller</Label>
        <Input id="shelf_location" name="shelf_location" placeholder="z.B. Regal B / Reihe 3" />
      </div>

      {trips.length > 0 && (
        <div className="space-y-2">
          <Label>Reise</Label>
          <Select name="trip_id">
            <SelectTrigger><SelectValue placeholder="Reise auswählen (optional)" /></SelectTrigger>
            <SelectContent>
              {trips.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" name="notes" placeholder="Allgemeine Notizen zum Wein…" />
      </div>

      <Button type="submit" className="w-full">Wein hinzufügen</Button>
    </form>
  )
}
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests PASS (wine-data, combobox, types)

- [ ] **Step 5: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:3000/wine/new` and verify:
- Name, Weingut, Rebsorte, Kaufort show a combobox button with placeholder
- Clicking opens a dropdown with search
- Typing "Tosk" in the Land-linked Region field (after selecting "Italien") shows "Toskana"
- Selecting "Italien" as Land then opening Region shows Italian regions only + any own regions
- Changing Land resets Region to empty
- Typing a value not in the list shows „xyz verwenden" option
- Submitting a new wine works and redirects to the wine detail page

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts app/wine/new/page.tsx app/wine/new/wine-form.tsx
git commit -m "feat: add autocomplete to wine form with country→region dependency"
```
