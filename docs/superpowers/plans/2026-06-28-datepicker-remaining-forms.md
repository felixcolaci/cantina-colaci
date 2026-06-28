# DatePicker in Remaining Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two remaining raw `<Input type="date">` fields with the existing `DatePicker` component — once in the "Flasche öffnen" sheet and once in the Entry-Bearbeiten sheet.

**Architecture:** Two independent one-file edits. Both files are already `'use client'` and use `useState`. No new components, no new tests — the `DatePicker` component is fully tested already. Build verification confirms correctness.

**Tech Stack:** React, TypeScript, existing `DatePicker` component at `components/ui/date-picker.tsx`.

## Global Constraints

- `DatePicker` props: `mode: DatePickerMode`, `name: string`, `value: number | string | null`, `onChange: (value: number | string | null) => void`, `placeholder?: string`
- Use `mode="full"` for both fields (full date: day/month/year)
- State type: `string | null` (ISO date string `"YYYY-MM-DD"` or `null`)
- Run build: `npm run build`
- Run tests: `npx vitest run`

---

### Task 1: DatePicker in "Flasche öffnen" sheet

**Files:**
- Modify: `app/wine/[id]/open-bottle-button.tsx`

**Context:** This file has `<Input id="date" name="date" type="date" defaultValue={today} required />` on line 34. The `today` variable is `new Date().toISOString().split('T')[0]`. We add a `useState` initialized with `today` and replace the Input with DatePicker. Since the state is always initialized with today, the field is never empty — the `required` attribute is safe to drop.

- [ ] **Step 1: Replace open-bottle-button.tsx**

Full updated `app/wine/[id]/open-bottle-button.tsx`:

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
import { DatePicker } from '@/components/ui/date-picker'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const { run, isPending, error } = useServerAction(openBottle)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full" />}>
        Flasche öffnen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Verkostung</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="cellar_entry_id" value={entryId} />
          <div className="space-y-2">
            <Label>Datum</Label>
            <DatePicker
              mode="full"
              name="date"
              value={date}
              onChange={v => setDate(v as string | null)}
              placeholder="Datum"
            />
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

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/wine/[id]/open-bottle-button.tsx
git commit -m "feat: use DatePicker for tasting date in open-bottle sheet"
```

---

### Task 2: DatePicker in Entry-Bearbeiten sheet

**Files:**
- Modify: `app/wine/[id]/entry-card.tsx`

**Context:** The edit sheet inside `EntryCard` has `<Input id="purchase_date" name="purchase_date" type="date" defaultValue={entry.purchase_date ?? ''} />` around line 148. We add a `useState` for `purchaseDate` initialized from `entry.purchase_date`, and replace the Input with DatePicker. The field is optional so `null` is a valid value.

- [ ] **Step 1: Add purchaseDate state and DatePicker import**

In `app/wine/[id]/entry-card.tsx`, make these two changes:

**1. Add import** (after existing imports):
```tsx
import { DatePicker } from '@/components/ui/date-picker'
```

**2. Add state** (inside the `EntryCard` function, after the existing `useState` calls):
```tsx
const [purchaseDate, setPurchaseDate] = useState<string | null>(entry.purchase_date ?? null)
```

**3. Replace the purchase_date field** (find the block around line 146–150):

Replace:
```tsx
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Kaufdatum</Label>
                <Input id="purchase_date" name="purchase_date" type="date"
                  defaultValue={entry.purchase_date ?? ''} />
              </div>
```

With:
```tsx
              <div className="space-y-2">
                <Label>Kaufdatum</Label>
                <DatePicker
                  mode="full"
                  name="purchase_date"
                  value={purchaseDate}
                  onChange={v => setPurchaseDate(v as string | null)}
                  placeholder="Kaufdatum"
                />
              </div>
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/wine/[id]/entry-card.tsx
git commit -m "feat: use DatePicker for purchase_date in entry edit sheet"
```
