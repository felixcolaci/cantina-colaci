# Form Submission UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate form submissions on mobile by adding loading state, inline error messages, and automatic network-error retries across all forms.

**Architecture:** A `useServerAction` hook centralises pending state (via `useTransition`), retry logic (3× with 500 ms delay for network errors), and error messages. A `SubmitButton` component renders a spinner and disables itself when pending. Every form imports these two pieces; no per-form boilerplate beyond a single hook call.

**Tech Stack:** React 19 (`useTransition`, `useRef`), Vitest + @testing-library/react (unit tests), Next.js App Router server actions.

## Global Constraints

- All user-facing strings are German
- Error messages must be generic: never leak server internals to the client
- Network error message: `"Netzwerkfehler – bitte Verbindung prüfen."`
- Generic error message: `"Fehler beim Speichern – bitte nochmal versuchen."`
- Max retries: 3, delay between retries: 500 ms
- Only `TypeError` (fetch/network failures) qualifies as a retryable network error
- Test runner: `npx vitest run` (unit) — no E2E changes needed in this plan

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/hooks/use-server-action.ts` | Hook: pending state, retry, error |
| Create | `lib/__tests__/use-server-action.test.ts` | Unit tests for the hook |
| Create | `components/ui/submit-button.tsx` | Spinner button, disabled when pending |
| Create | `lib/__tests__/submit-button.test.tsx` | Unit tests for SubmitButton |
| Modify | `app/wine/new/wine-form.tsx` | Adopt hook + SubmitButton |
| Modify | `app/trips/new-trip-form.tsx` | Adopt hook + SubmitButton |
| Modify | `app/onboarding/onboarding-form.tsx` | Adopt hook + SubmitButton |
| Modify | `app/wine/[id]/open-bottle-button.tsx` | Adopt hook + SubmitButton |
| Modify | `app/(auth)/login/login-form.tsx` | Adopt hook + SubmitButton, remove manual loading state |

---

## Task 1: `useServerAction` hook

**Files:**
- Create: `lib/hooks/use-server-action.ts`
- Create: `lib/__tests__/use-server-action.test.ts`

**Interfaces:**
- Produces: `useServerAction<T extends unknown[]>(action: (...args: T) => Promise<void>) → { run: (...args: T) => void, isPending: boolean, error: string | null, clearError: () => void }`

---

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/use-server-action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useServerAction } from '@/lib/hooks/use-server-action'

describe('useServerAction', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls the action and leaves error null on success', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it('sets generic error message for non-network errors', async () => {
    const action = vi.fn().mockRejectedValue(new Error('DB constraint violated'))
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(result.current.error).toBe('Fehler beim Speichern – bitte nochmal versuchen.')
    expect(action).toHaveBeenCalledTimes(1) // no retries for non-network errors
  })

  it('retries network errors 3 times then sets network error message', async () => {
    const networkError = new TypeError('Failed to fetch')
    const action = vi.fn().mockRejectedValue(networkError)
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(3)
    expect(result.current.error).toBe('Netzwerkfehler – bitte Verbindung prüfen.')
  })

  it('succeeds on second attempt after initial network failure', async () => {
    const networkError = new TypeError('Failed to fetch')
    const action = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })

  it('does not retry non-TypeError errors even with "fetch" in message', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fetch quota exceeded'))
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBe('Fehler beim Speichern – bitte nochmal versuchen.')
  })

  it('clearError resets error to null', async () => {
    const action = vi.fn().mockRejectedValue(new Error('oops'))
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())
    expect(result.current.error).not.toBeNull()

    act(() => { result.current.clearError() })
    expect(result.current.error).toBeNull()
  })

  it('passes arguments to the action', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useServerAction(action))
    const fd = new FormData()
    fd.set('name', 'Barolo')

    act(() => { result.current.run(fd) })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledWith(fd)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/use-server-action.test.ts
```

Expected: all tests fail with `Cannot find module '@/lib/hooks/use-server-action'`

- [ ] **Step 3: Create `lib/hooks/use-server-action.ts`**

```ts
'use client'

import { useTransition, useState, useRef, useCallback } from 'react'

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false
  const msg = (err as TypeError).message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('fetch')
  )
}

async function withRetry<T extends unknown[]>(
  action: (...args: T) => Promise<void>,
  args: T,
  maxAttempts = 3,
  delayMs = 500,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await action(...args)
      return
    } catch (err) {
      if (!isNetworkError(err) || attempt === maxAttempts - 1) throw err
      await new Promise<void>(resolve => setTimeout(resolve, delayMs))
    }
  }
}

export function useServerAction<T extends unknown[]>(action: (...args: T) => Promise<void>) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const actionRef = useRef(action)
  actionRef.current = action

  const run = useCallback((...args: T) => {
    startTransition(async () => {
      setError(null)
      try {
        await withRetry(actionRef.current, args)
      } catch (err) {
        if (isNetworkError(err)) {
          setError('Netzwerkfehler – bitte Verbindung prüfen.')
        } else {
          setError('Fehler beim Speichern – bitte nochmal versuchen.')
        }
      }
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { run, isPending, error, clearError }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/use-server-action.test.ts
```

Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-server-action.ts lib/__tests__/use-server-action.test.ts
git commit -m "feat: add useServerAction hook with retry and error handling"
```

---

## Task 2: `SubmitButton` component

**Files:**
- Create: `components/ui/submit-button.tsx`
- Create: `lib/__tests__/submit-button.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`
- Produces: `<SubmitButton isPending={boolean} ...ButtonProps>children</SubmitButton>`

---

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/submit-button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubmitButton } from '@/components/ui/submit-button'

describe('SubmitButton', () => {
  it('renders children', () => {
    render(<SubmitButton isPending={false}>Wein hinzufügen</SubmitButton>)
    expect(screen.getByText('Wein hinzufügen')).toBeInTheDocument()
  })

  it('is not disabled when isPending is false', () => {
    render(<SubmitButton isPending={false}>Speichern</SubmitButton>)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('is disabled when isPending is true', () => {
    render(<SubmitButton isPending={true}>Speichern</SubmitButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows a spinner when isPending is true', () => {
    render(<SubmitButton isPending={true}>Speichern</SubmitButton>)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('does not show a spinner when isPending is false', () => {
    render(<SubmitButton isPending={false}>Speichern</SubmitButton>)
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('has type="submit"', () => {
    render(<SubmitButton isPending={false}>Speichern</SubmitButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/submit-button.test.tsx
```

Expected: all fail with `Cannot find module '@/components/ui/submit-button'`

- [ ] **Step 3: Create `components/ui/submit-button.tsx`**

```tsx
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ButtonProps = React.ComponentProps<typeof Button>

export function SubmitButton({
  isPending,
  children,
  ...props
}: ButtonProps & { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} {...props}>
      {isPending && <Loader2 className="animate-spin" />}
      <span className={isPending ? 'opacity-60' : undefined}>{children}</span>
    </Button>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/submit-button.test.tsx
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/ui/submit-button.tsx lib/__tests__/submit-button.test.tsx
git commit -m "feat: add SubmitButton component with loading spinner"
```

---

## Task 3: Migrate `wine-form.tsx`

**Files:**
- Modify: `app/wine/new/wine-form.tsx`

**Interfaces:**
- Consumes: `useServerAction` from `@/lib/hooks/use-server-action`, `SubmitButton` from `@/components/ui/submit-button`

---

- [ ] **Step 1: Replace the form's submit wiring**

Open `app/wine/new/wine-form.tsx`. Replace the entire file with:

```tsx
'use client'

import { useState } from 'react'
import { addWine } from '@/lib/actions/wine'
import { compressImage } from '@/lib/image-compress'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
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

  const { run, isPending, error } = useServerAction(async (formData: FormData) => {
    if (compressedFile) formData.set('photo', compressedFile)
    await addWine(formData)
  })

  const countryOptions = [...new Set([...WINE_COUNTRIES, ...hints.ownCountries])]
  const regionOptions = [...new Set([
    ...(WINE_REGIONS[country] ?? []),
    ...(hints.ownRegionsByCountry[country] ?? []),
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

  return (
    <form
      onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
      className="space-y-4 pb-8"
    >
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      <SubmitButton isPending={isPending} className="w-full">Wein hinzufügen</SubmitButton>
    </form>
  )
}
```

- [ ] **Step 2: Run unit tests to ensure nothing broke**

```bash
npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add app/wine/new/wine-form.tsx
git commit -m "feat: add loading state and error handling to wine form"
```

---

## Task 4: Migrate simple server-action forms

Applies the same pattern to three forms that currently use `action={serverAction}` directly: `new-trip-form.tsx`, `onboarding-form.tsx`, and `open-bottle-button.tsx`. All three are uncontrolled forms — no controlled state needs to change.

**Files:**
- Modify: `app/trips/new-trip-form.tsx`
- Modify: `app/onboarding/onboarding-form.tsx`
- Modify: `app/wine/[id]/open-bottle-button.tsx`

**Interfaces:**
- Consumes: `useServerAction` from `@/lib/hooks/use-server-action`, `SubmitButton` from `@/components/ui/submit-button`
- Consumes: `createTrip` from `@/lib/actions/trips`, `createFamilyAndCellar` from `@/lib/actions/family`, `openBottle` from `@/lib/actions/tasting`

---

- [ ] **Step 1: Update `app/trips/new-trip-form.tsx`**

Replace the entire file:

```tsx
'use client'

import { createTrip } from '@/lib/actions/trips'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'
import { Plus } from 'lucide-react'

export function NewTripForm() {
  const [open, setOpen] = useState(false)
  const { run, isPending, error } = useServerAction(createTrip)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full" />}>
        <Plus className="h-4 w-4 mr-2" />Neue Reise
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader><SheetTitle>Neue Reise</SheetTitle></SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" placeholder="Toskana Sommer 2026" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Ort</Label>
            <Input id="location" name="location" placeholder="Toskana, Italien" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date_start">Beginn</Label>
              <Input id="date_start" name="date_start" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_end">Ende</Label>
              <Input id="date_end" name="date_end" type="date" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Reise anlegen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Update `app/onboarding/onboarding-form.tsx`**

Replace the entire file:

```tsx
'use client'

import { createFamilyAndCellar } from '@/lib/actions/family'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingForm() {
  const { run, isPending, error } = useServerAction(createFamilyAndCellar)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deinen Keller anlegen</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="familyName">Familienname</Label>
            <Input id="familyName" name="familyName" placeholder="Colaci" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellarName">Keller-Name</Label>
            <Input id="cellarName" name="cellarName" placeholder="Hauptkeller" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Keller anlegen</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Update `app/wine/[id]/open-bottle-button.tsx`**

Replace the entire file:

```tsx
'use client'

import { useState } from 'react'
import { openBottle } from '@/lib/actions/tasting'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const { run, isPending, error } = useServerAction(openBottle)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full" />}>
        🍾 Flasche öffnen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Verkostung — Salute! 🥂</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="cellar_entry_id" value={entryId} />
          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input id="date" name="date" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Bewertung (1–10)</Label>
            <Input id="rating" name="rating" type="number" min="1" max="10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Verkostungsnotizen</Label>
            <Textarea id="notes" name="notes" placeholder="Duft, Geschmack, Begleitung…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Verkostung speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run unit tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/trips/new-trip-form.tsx app/onboarding/onboarding-form.tsx app/wine/[id]/open-bottle-button.tsx
git commit -m "feat: add loading state and error handling to trip, onboarding, and open-bottle forms"
```

---

## Task 5: Migrate `login-form.tsx`

The login form already has manual `loading` and `error` state — replace both with `useServerAction`. The `sent` state (OTP confirmation screen) is unrelated to submission state and stays.

**Files:**
- Modify: `app/(auth)/login/login-form.tsx`

**Interfaces:**
- Consumes: `useServerAction` from `@/lib/hooks/use-server-action`, `SubmitButton` from `@/components/ui/submit-button`

---

- [ ] **Step 1: Update `app/(auth)/login/login-form.tsx`**

Replace the entire file:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const { run, isPending, error } = useServerAction(async () => {
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (otpError) throw new Error(otpError.message)
    setSent(true)
  })

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schau in deine E-Mails</CardTitle>
          <CardDescription>Ciao! Wir haben dir einen Anmeldelink an {email} geschickt. 👋</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>E-Mail eingeben — wir schicken dir einen magischen Link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="felix@colaci.eu"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Link senden</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add app/(auth)/login/login-form.tsx
git commit -m "feat: replace manual loading state with useServerAction in login form"
```
