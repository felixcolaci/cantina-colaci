# Label Scan + Cost Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Etikett scannen" button to both wine entry forms that opens the device camera, sends the photo to Claude Haiku 4.5 vision, pre-fills the wine fields, and logs API cost per family to `api_usage_logs`.

**Architecture:** Client compresses the photo with the existing `compressImage` utility, then calls a server action `scanWineLabel`. The server action sends the image to Anthropic's API via `@anthropic-ai/sdk`, parses structured JSON from the response, writes cost data to `api_usage_logs`, and returns pre-fill data to the client. The `ScanLabelButton` component handles file input, loading state, and the `onResult` callback.

**Tech Stack:** Next.js App Router, `@anthropic-ai/sdk`, Supabase admin client, existing `compressImage` utility (`lib/image-compress.ts`), existing CSS custom-property design system (no Tailwind color classes), Lucide icons.

## Global Constraints

- No Tailwind color classes — use CSS custom properties only (`var(--primary)`, `var(--destructive)`, etc.)
- Fonts: `var(--font-display)` / `var(--font-body)` / `var(--font-mono)` only — no inline font-family strings
- Model ID (exact): `claude-haiku-4-5-20251001`
- Haiku 4.5 pricing: input `$1 / 1_000_000 tokens`, output `$5 / 1_000_000 tokens`
- `cost_usd` column type: `numeric(10,6)` — store 6 decimal places
- `feature` value for label scans (exact string): `'label_scan'`
- DB migration numbering: next is `011_api_usage_logs.sql`
- `ANTHROPIC_API_KEY` env var must exist — the action reads it implicitly via the SDK default. Add to `.env.local` if missing.
- No test framework in this project — verification steps are manual (build + browser)
- Do not add comments to code unless the WHY is non-obvious

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/011_api_usage_logs.sql` | Create | `api_usage_logs` table + index |
| `lib/actions/scan-label.ts` | Create | Server action: Anthropic call, cost logging, JSON parse |
| `components/cellar/scan-label-button.tsx` | Create | Camera input, loading state, `onResult` callback |
| `app/cellar/quick-add-sheet.tsx` | Modify | Add scan button at top; make name/producer controlled; wire `onResult` |
| `app/wine/new/wine-form.tsx` | Modify | Add scan button at top; wire `onResult` to existing controlled state |

---

## Task 1: DB Migration — `api_usage_logs`

**Files:**
- Create: `supabase/migrations/011_api_usage_logs.sql`

**Interfaces:**
- Produces: table `api_usage_logs(id, family_id, feature, model, input_tokens, output_tokens, cost_usd, created_at)` for Task 2

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/011_api_usage_logs.sql
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  feature       text        NOT NULL,
  model         text        NOT NULL,
  input_tokens  integer     NOT NULL,
  output_tokens integer     NOT NULL,
  cost_usd      numeric(10,6) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON api_usage_logs (family_id, created_at DESC);

ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
```

No public RLS policies — only the admin client writes/reads this table (internal billing).

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Confirm `api_usage_logs` appears in Supabase dashboard → Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_api_usage_logs.sql
git commit -m "feat: add api_usage_logs table for per-family cost tracking"
```

---

## Task 2: Install SDK + Server Action

**Files:**
- Modify: `package.json` (install)
- Create: `lib/actions/scan-label.ts`

**Interfaces:**
- Consumes: `api_usage_logs` table from Task 1
- Produces:
  ```ts
  // lib/actions/scan-label.ts
  export interface ScanResult {
    name?: string
    producer?: string
    vintage?: number | null
    type?: 'red' | 'white' | 'rosé' | 'sparkling'
    country?: string
    region?: string
    grape_variety?: string
  }
  export async function scanWineLabel(formData: FormData): Promise<ScanResult & { error?: string }>
  ```

- [ ] **Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Verify `ANTHROPIC_API_KEY` is present**

```bash
grep ANTHROPIC_API_KEY .env.local || echo "MISSING — add it now"
```

If missing, add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local` before continuing.

- [ ] **Step 3: Create `lib/actions/scan-label.ts`**

```ts
'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MODEL = 'claude-haiku-4-5-20251001'
const INPUT_COST  = 1 / 1_000_000
const OUTPUT_COST = 5 / 1_000_000

export interface ScanResult {
  name?: string
  producer?: string
  vintage?: number | null
  type?: 'red' | 'white' | 'rosé' | 'sparkling'
  country?: string
  region?: string
  grape_variety?: string
}

export async function scanWineLabel(
  formData: FormData,
): Promise<ScanResult & { error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet' }

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return { error: 'Keine Familie gefunden' }

  const image = formData.get('image') as File | null
  if (!image || image.size === 0) return { error: 'Kein Bild' }

  const bytes   = await image.arrayBuffer()
  const base64  = Buffer.from(bytes).toString('base64')
  const mediaType = (
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type)
      ? image.type
      : 'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const client = new Anthropic()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Analysiere dieses Weinetikett und antworte NUR mit einem JSON-Objekt (kein Markdown, keine Erklärungen):

{
  "name": "Weinname (z.B. Barolo, Chianti Classico)",
  "producer": "Produzent / Weingut",
  "vintage": 2018,
  "type": "red" | "white" | "rosé" | "sparkling",
  "country": "Land auf Englisch (z.B. Italy, France, Germany)",
  "region": "Region (z.B. Toscana, Bordeaux, Rheingau)",
  "grape_variety": "Rebsorte(n) (z.B. Sangiovese, Cabernet Sauvignon)"
}

Felder die du nicht erkennst, lasse vollständig weg. "vintage" muss eine 4-stellige Jahreszahl sein.`,
        },
      ],
    }],
  })

  const inputTokens  = message.usage.input_tokens
  const outputTokens = message.usage.output_tokens
  const costUsd = inputTokens * INPUT_COST + outputTokens * OUTPUT_COST

  await admin.from('api_usage_logs').insert({
    family_id:     membership.family_id,
    feature:       'label_scan',
    model:         MODEL,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    cost_usd:      costUsd,
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { error: 'Etikett konnte nicht gelesen werden' }
    const p = JSON.parse(jsonMatch[0])
    const currentYear = new Date().getFullYear()
    return {
      name:         p.name     || undefined,
      producer:     p.producer || undefined,
      vintage:      typeof p.vintage === 'number' && p.vintage > 1900 && p.vintage <= currentYear + 1
                      ? p.vintage : undefined,
      type:         ['red', 'white', 'rosé', 'sparkling'].includes(p.type) ? p.type : undefined,
      country:      p.country      || undefined,
      region:       p.region       || undefined,
      grape_variety: p.grape_variety || undefined,
    }
  } catch {
    return { error: 'Etikett konnte nicht gelesen werden' }
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -5
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/scan-label.ts package.json package-lock.json
git commit -m "feat: add scanWineLabel server action with cost logging"
```

---

## Task 3: ScanLabelButton Component

**Files:**
- Create: `components/cellar/scan-label-button.tsx`

**Interfaces:**
- Consumes: `scanWineLabel` and `ScanResult` from `lib/actions/scan-label` (Task 2), `compressImage` from `lib/image-compress`
- Produces:
  ```ts
  // components/cellar/scan-label-button.tsx
  export function ScanLabelButton(props: {
    onResult: (result: ScanResult) => void
  }): JSX.Element
  ```

- [ ] **Step 1: Create `components/cellar/scan-label-button.tsx`**

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scanWineLabel } from '@/lib/actions/scan-label'
import type { ScanResult } from '@/lib/actions/scan-label'
import { compressImage } from '@/lib/image-compress'

export function ScanLabelButton({ onResult }: { onResult: (r: ScanResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    startTransition(async () => {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.set('image', compressed)
      const result = await scanWineLabel(fd)
      if (result.error) {
        setError(result.error)
      } else {
        onResult(result)
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          gap: 6,
          borderStyle: 'dashed',
          color: 'var(--muted-foreground)',
        }}
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Etikett wird gelesen…</>
          : <><Camera className="h-4 w-4" /> Etikett scannen</>
        }
      </Button>
      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add components/cellar/scan-label-button.tsx
git commit -m "feat: add ScanLabelButton component with camera capture and loading state"
```

---

## Task 4: Integrate Into QuickAddSheet + WineForm

**Files:**
- Modify: `app/cellar/quick-add-sheet.tsx`
- Modify: `app/wine/new/wine-form.tsx`

**Interfaces:**
- Consumes: `ScanLabelButton` from `components/cellar/scan-label-button` (Task 3), `ScanResult` from `lib/actions/scan-label`

### Part A: QuickAddSheet

`name` and `producer` are currently uncontrolled inputs. Make them controlled so scan results can pre-fill them.

- [ ] **Step 1: Modify `app/cellar/quick-add-sheet.tsx`**

Add `name` and `producer` state, import `ScanLabelButton`, add scan button above the form fields, wire `onResult`.

Replace the entire file with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { quickAddWine } from '@/lib/actions/quick-add'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { queueAction } from '@/lib/offline/db'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScanLabelButton } from '@/components/cellar/scan-label-button'
import type { ScanResult } from '@/lib/actions/scan-label'

const WINE_TYPES = [
  { value: 'red',       label: 'Rot' },
  { value: 'white',     label: 'Weiß' },
  { value: 'rosé',      label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
] as const

type WineTypeValue = typeof WINE_TYPES[number]['value']

export function QuickAddSheet({
  storageLocationId,
  storageLocationName,
  nameHints = [],
  producerHints = [],
}: {
  storageLocationId: string | null
  storageLocationName: string
  nameHints?: string[]
  producerHints?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [wineType, setWineType] = useState<WineTypeValue>('red')
  const [vintage, setVintage] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const { run, isPending, error, offlineSaved } = useServerAction(
    quickAddWine,
    (fd) => queueAction('quickAddWine', fd),
  )

  useEffect(() => {
    if (offlineSaved) setOpen(false)
  }, [offlineSaved])

  function handleScanResult(result: ScanResult) {
    if (result.name)     setName(result.name)
    if (result.producer) setProducer(result.producer)
    if (result.vintage)  setVintage(result.vintage)
    if (result.type && WINE_TYPES.some(t => t.value === result.type)) {
      setWineType(result.type as WineTypeValue)
    }
  }

  const listId         = `names-${storageLocationId ?? 'none'}`
  const producerListId = `producers-${storageLocationId ?? 'none'}`

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button size="sm" variant="outline" style={{ height: 28, padding: '0 8px' }}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Wein hinzufügen
            {storageLocationId && (
              <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)', marginLeft: 8 }}>
                · {storageLocationName}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          {nameHints.length > 0 && (
            <datalist id={listId}>
              {nameHints.map(h => <option key={h} value={h} />)}
            </datalist>
          )}
          {producerHints.length > 0 && (
            <datalist id={producerListId}>
              {producerHints.map(h => <option key={h} value={h} />)}
            </datalist>
          )}

          <ScanLabelButton onResult={handleScanResult} />

          <input type="hidden" name="storage_location_id" value={storageLocationId ?? ''} />
          <input type="hidden" name="type" value={wineType} />

          <div className="space-y-2">
            <Label htmlFor="qs-name">Name *</Label>
            <Input
              id="qs-name" name="name" required
              placeholder="z.B. Barolo"
              value={name}
              onChange={e => setName(e.target.value)}
              list={nameHints.length > 0 ? listId : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-producer">Produzent</Label>
            <Input
              id="qs-producer" name="producer"
              placeholder="z.B. Gaja"
              value={producer}
              onChange={e => setProducer(e.target.value)}
              list={producerHints.length > 0 ? producerListId : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="flex gap-2">
              {WINE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setWineType(t.value)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    border: '1px solid',
                    cursor: 'pointer',
                    transition: 'background var(--duration-fast), color var(--duration-fast)',
                    background: wineType === t.value ? 'var(--primary)' : 'var(--background)',
                    color: wineType === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                    borderColor: wineType === t.value ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker
                mode="year"
                name="vintage"
                value={vintage}
                onChange={v => setVintage(v as number | null)}
                placeholder="Jahr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qs-quantity">Anzahl *</Label>
              <Input
                id="qs-quantity" name="quantity" type="number"
                min="1" max="999" defaultValue={1} required
              />
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Hinzufügen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

### Part B: WineForm

`WineForm` already has controlled state for all fields. Just add the scan button and wire `onResult`.

- [ ] **Step 2: Modify `app/wine/new/wine-form.tsx`**

Add import for `ScanLabelButton` and `ScanResult` at the top:

```ts
import { ScanLabelButton } from '@/components/cellar/scan-label-button'
import type { ScanResult } from '@/lib/actions/scan-label'
```

Add `handleScanResult` function inside `WineForm`, just before the `return`:

```ts
function handleScanResult(result: ScanResult) {
  if (result.name)          setName(result.name)
  if (result.producer)      setProducer(result.producer)
  if (result.vintage)       setVintage(result.vintage)
  if (result.country)       setCountry(result.country)
  if (result.region)        setRegion(result.region)
  if (result.grape_variety) setGrapeVariety(result.grape_variety)
}
```

Add `<ScanLabelButton onResult={handleScanResult} />` as the **first element** inside the `<form>`, before the "Foto der Flasche" block:

```tsx
<form
  onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
  className="space-y-4 pb-8"
>
  <ScanLabelButton onResult={handleScanResult} />

  <div className="space-y-2">
    <Label>Foto der Flasche</Label>
    {/* ... existing photo block unchanged ... */}
  </div>
  {/* ... rest of form unchanged ... */}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -5
```

Expected: no errors, `✓ Compiled`.

- [ ] **Step 4: Manual smoke test**

1. `npm run dev`
2. Open `/cellar` → tap `+` on a location group → tap "Etikett scannen" → pick a wine photo → confirm fields pre-fill
3. Open `/wine/new` → tap "Etikett scannen" → pick a wine photo → confirm fields pre-fill
4. Check Supabase dashboard → `api_usage_logs` → confirm a row was inserted with correct `family_id`, `feature = 'label_scan'`, non-zero `cost_usd`

- [ ] **Step 5: Commit**

```bash
git add app/cellar/quick-add-sheet.tsx app/wine/new/wine-form.tsx
git commit -m "feat: integrate label scan into QuickAddSheet and WineForm"
```
