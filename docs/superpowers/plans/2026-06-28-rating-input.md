# Rating Input Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain number input for ratings with a 5-button visual selector and update all rating displays from `/10` to `/5`.

**Architecture:** Two tasks: (1) a standalone `RatingInput` component with tests, (2) wire it into the "Flasche öffnen" sheet and update the three `/10` → `/5` display sites. Task 2 depends on `components/dashboard/tasting-card.tsx` which is created by the Dashboard Redesign plan — run that plan first.

**Tech Stack:** React, TypeScript, Vitest + React Testing Library, CSS custom properties design system.

## Global Constraints

- All visual tokens via `var(--...)` — no hardcoded hex or Tailwind color classes
- Display font: `var(--font-display)` (Cormorant Garamond)
- Unselected button: `background: var(--parchment)`, `color: var(--ink-700)`, `border: 1px solid var(--border)`
- Selected button: `background: var(--primary)`, `color: white`, no border
- Button height: `52px`, `border-radius: var(--radius-md)`
- Transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`
- Run tests: `npx vitest run`
- Run build: `npm run build`
- **Prerequisite for Task 2:** Dashboard Redesign plan must be executed first (creates `components/dashboard/tasting-card.tsx`)

---

### Task 1: RatingInput component

**Files:**
- Create: `components/ui/rating-input.tsx`
- Create: `lib/__tests__/rating-input.test.tsx`

**Interfaces:**
- Produces: `RatingInput({ name, value, onChange })` — used by `app/wine/[id]/open-bottle-button.tsx` in Task 2

```ts
// Exact prop type produced by this task
type RatingInputProps = {
  name: string
  value: number | null
  onChange: (v: number) => void
}
```

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/rating-input.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RatingInput } from '@/components/ui/rating-input'

describe('RatingInput', () => {
  it('renders 5 buttons', () => {
    render(<RatingInput name="rating" value={null} onChange={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('renders buttons labeled 1 through 5', () => {
    render(<RatingInput name="rating" value={null} onChange={() => {}} />)
    ;[1, 2, 3, 4, 5].forEach(n => {
      expect(screen.getByText(String(n))).toBeInTheDocument()
    })
  })

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn()
    render(<RatingInput name="rating" value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('4'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('renders a hidden input with the current value', () => {
    const { container } = render(<RatingInput name="rating" value={3} onChange={() => {}} />)
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement
    expect(hidden.name).toBe('rating')
    expect(hidden.value).toBe('3')
  })

  it('renders empty hidden input when value is null', () => {
    const { container } = render(<RatingInput name="rating" value={null} onChange={() => {}} />)
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement
    expect(hidden.value).toBe('')
  })

  it('marks the selected button as active (aria-pressed)', () => {
    render(<RatingInput name="rating" value={3} onChange={() => {}} />)
    expect(screen.getByText('3').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/rating-input.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/ui/rating-input'`

- [ ] **Step 3: Implement RatingInput**

Create `components/ui/rating-input.tsx`:

```tsx
'use client'

type RatingInputProps = {
  name: string
  value: number | null
  onChange: (v: number) => void
}

export function RatingInput({ name, value, onChange }: RatingInputProps) {
  return (
    <div>
      <input type="hidden" name={name} value={value ?? ''} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(n)}
              style={{
                height: 52,
                borderRadius: 'var(--radius-md)',
                border: selected ? 'none' : '1px solid var(--border)',
                background: selected ? 'var(--primary)' : 'var(--parchment)',
                color: selected ? 'white' : 'var(--ink-700)',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/rating-input.test.tsx
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/ui/rating-input.tsx lib/__tests__/rating-input.test.tsx
git commit -m "feat: add RatingInput component (1-5 visual selector)"
```

---

### Task 2: Wire RatingInput + update /5 displays

> **Prerequisite:** The Dashboard Redesign plan must have been executed — `components/dashboard/tasting-card.tsx` must exist.

**Files:**
- Modify: `app/wine/[id]/open-bottle-button.tsx`
- Modify: `components/dashboard/tasting-card.tsx`
- Modify: `app/wine/[id]/page.tsx`

**Interfaces:**
- Consumes: `RatingInput` from `@/components/ui/rating-input` (Task 1)

**Context for open-bottle-button.tsx:** By this point the DatePicker plan (2026-06-28-datepicker-remaining-forms.md) has already replaced the `<Input type="date">` with `<DatePicker>`. The file no longer uses `Input` after we replace the rating field here — remove the import.

- [ ] **Step 1: Update open-bottle-button.tsx**

Full updated `app/wine/[id]/open-bottle-button.tsx` (reflects both DatePicker plan + this plan):

```tsx
'use client'

import { useState } from 'react'
import { openBottle } from '@/lib/actions/tasting'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { RatingInput } from '@/components/ui/rating-input'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [rating, setRating] = useState<number | null>(null)
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
            <Label>Bewertung</Label>
            <RatingInput name="rating" value={rating} onChange={setRating} />
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

- [ ] **Step 2: Update TastingCard — /10 → /5**

In `components/dashboard/tasting-card.tsx`, find the `/10` suffix and change it:

```tsx
// Find this:
<span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/10</span>

// Replace with:
<span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/5</span>
```

- [ ] **Step 3: Update wine detail page — /10 → /5**

In `app/wine/[id]/page.tsx`, find the `/10` suffix around line 276 and change it:

```tsx
// Find this:
<span style={{ fontSize: '0.65em', fontWeight: 400, color: 'var(--muted-foreground)' }}>
  /10
</span>

// Replace with:
<span style={{ fontSize: '0.65em', fontWeight: 400, color: 'var(--muted-foreground)' }}>
  /5
</span>
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add app/wine/[id]/open-bottle-button.tsx components/dashboard/tasting-card.tsx app/wine/[id]/page.tsx
git commit -m "feat: wire RatingInput into tasting sheet, update rating display to /5"
```
