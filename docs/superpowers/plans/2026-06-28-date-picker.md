# DatePicker Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standardized `<DatePicker>` component with three modes (year / full / partial) and replace all ad-hoc date inputs across the wine cellar app.

**Architecture:** Single `DatePicker` component with a `mode` prop controls a Popover containing either a year grid, a month grid, or a `react-day-picker` calendar depending on mode and precision. It always renders a hidden `<input>` for FormData compatibility and emits values via `onChange`. No server action changes required.

**Tech Stack:** react-day-picker v10, date-fns v4, `@base-ui/react` Popover, Tailwind v4, Vitest + Testing Library

## Global Constraints

- German UI copy only — all labels, buttons, and placeholders must be in German
- Hidden `<input type="hidden">` must always render so FormData parsing in existing server actions works unchanged
- `partial` mode storage: year-only → `YYYY-01-01`, year+month → `YYYY-MM-01`, full date → `YYYY-MM-DD`
- No changes to `lib/actions/wine.ts` or `lib/actions/trips.ts`
- All UI components are `'use client'`
- Run `npm test -- --run` to verify the full test suite after each task

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install react-day-picker and date-fns**

```bash
npm install react-day-picker date-fns
```

Expected: packages appear in `package.json` dependencies.

- [ ] **Step 2: Confirm the CSS stylesheet path**

```bash
ls node_modules/react-day-picker/*.css
```

Expected: `node_modules/react-day-picker/style.css` exists. If only `dist/style.css` exists, use that path in the import in Task 2.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-day-picker and date-fns"
```

---

### Task 2: Create `DatePicker` component

**Files:**
- Create: `components/ui/date-picker.tsx`
- Create: `lib/__tests__/date-picker.test.tsx`

**Interfaces — produced by this task and consumed by Tasks 3 & 4:**

```ts
export type DatePickerMode = 'year' | 'full' | 'partial'
export type Precision = 'year' | 'month' | 'day'

export interface DatePickerProps {
  mode: DatePickerMode
  name: string
  value: number | string | null
  onChange: (value: number | string | null) => void
  placeholder?: string
}

export function inferPrecision(value: string | null): Precision
export function formatDisplayValue(mode: DatePickerMode, value: number | string | null, precision?: Precision): string
export function toHiddenInputValue(mode: DatePickerMode, value: number | string | null): string
export function DatePicker(props: DatePickerProps): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/date-picker.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  formatDisplayValue,
  inferPrecision,
  toHiddenInputValue,
  DatePicker,
} from '@/components/ui/date-picker'

describe('inferPrecision', () => {
  it('returns day for null', () => expect(inferPrecision(null)).toBe('day'))
  it('returns year for YYYY-01-01', () => expect(inferPrecision('2022-01-01')).toBe('year'))
  it('returns month for YYYY-MM-01 where MM is not 01', () => expect(inferPrecision('2022-03-01')).toBe('month'))
  it('returns day for YYYY-MM-DD where DD is not 01', () => expect(inferPrecision('2022-03-15')).toBe('day'))
})

describe('formatDisplayValue', () => {
  it('returns year string for mode=year', () =>
    expect(formatDisplayValue('year', 2022)).toBe('2022'))
  it('returns empty string for null value', () =>
    expect(formatDisplayValue('full', null)).toBe(''))
  it('returns German full date for mode=full', () =>
    expect(formatDisplayValue('full', '2022-03-15')).toBe('15. März 2022'))
  it('returns year string for partial with year precision', () =>
    expect(formatDisplayValue('partial', '2022-01-01', 'year')).toBe('2022'))
  it('returns month+year for partial with month precision', () =>
    expect(formatDisplayValue('partial', '2022-03-01', 'month')).toBe('März 2022'))
  it('returns full date for partial with day precision', () =>
    expect(formatDisplayValue('partial', '2022-03-15', 'day')).toBe('15. März 2022'))
})

describe('toHiddenInputValue', () => {
  it('returns empty string for null', () =>
    expect(toHiddenInputValue('full', null)).toBe(''))
  it('returns year as string for mode=year', () =>
    expect(toHiddenInputValue('year', 2022)).toBe('2022'))
  it('returns ISO string for mode=full', () =>
    expect(toHiddenInputValue('full', '2022-03-15')).toBe('2022-03-15'))
  it('returns ISO string for mode=partial', () =>
    expect(toHiddenInputValue('partial', '2022-01-01')).toBe('2022-01-01'))
})

describe('DatePicker', () => {
  it('renders a hidden input with correct name and empty value when null', () => {
    render(<DatePicker mode="full" name="purchase_date" value={null} onChange={() => {}} />)
    const input = document.querySelector('input[type="hidden"][name="purchase_date"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('')
  })

  it('renders hidden input with value when date is set (full mode)', () => {
    render(<DatePicker mode="full" name="date_start" value="2022-03-15" onChange={() => {}} />)
    const input = document.querySelector('input[type="hidden"][name="date_start"]') as HTMLInputElement
    expect(input.value).toBe('2022-03-15')
  })

  it('renders hidden input with year value (year mode)', () => {
    render(<DatePicker mode="year" name="vintage" value={2019} onChange={() => {}} />)
    const input = document.querySelector('input[type="hidden"][name="vintage"]') as HTMLInputElement
    expect(input.value).toBe('2019')
  })

  it('shows placeholder in trigger when no value', () => {
    render(<DatePicker mode="full" name="date_start" value={null} onChange={() => {}} placeholder="Startdatum" />)
    expect(screen.getByText('Startdatum')).toBeInTheDocument()
  })

  it('shows formatted value in trigger when value is set (full)', () => {
    render(<DatePicker mode="full" name="date_start" value="2022-03-15" onChange={() => {}} placeholder="Startdatum" />)
    expect(screen.getByText('15. März 2022')).toBeInTheDocument()
  })

  it('shows year in trigger for mode=year', () => {
    render(<DatePicker mode="year" name="vintage" value={2019} onChange={() => {}} placeholder="Jahrgang" />)
    expect(screen.getByText('2019')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --run lib/__tests__/date-picker.test.tsx
```

Expected: FAIL with `Cannot find module '@/components/ui/date-picker'`.

- [ ] **Step 3: Create `components/ui/date-picker.tsx`**

```tsx
'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { de } from 'date-fns/locale'
import { format } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import 'react-day-picker/style.css'

export type DatePickerMode = 'year' | 'full' | 'partial'
export type Precision = 'year' | 'month' | 'day'

export interface DatePickerProps {
  mode: DatePickerMode
  name: string
  value: number | string | null
  onChange: (value: number | string | null) => void
  placeholder?: string
}

export function inferPrecision(value: string | null): Precision {
  if (!value) return 'day'
  const [, m, d] = value.split('-').map(Number)
  if (m === 1 && d === 1) return 'year'
  if (d === 1) return 'month'
  return 'day'
}

export function formatDisplayValue(
  mode: DatePickerMode,
  value: number | string | null,
  precision?: Precision,
): string {
  if (value === null || value === undefined) return ''
  if (mode === 'year') return String(value)
  const s = value as string
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  if (mode === 'full') return format(date, 'd. MMMM yyyy', { locale: de })
  const prec = precision ?? inferPrecision(s)
  if (prec === 'year') return String(y)
  if (prec === 'month') return format(date, 'MMMM yyyy', { locale: de })
  return format(date, 'd. MMMM yyyy', { locale: de })
}

export function toHiddenInputValue(
  mode: DatePickerMode,
  value: number | string | null,
): string {
  if (value === null || value === undefined) return ''
  if (mode === 'year') return String(value)
  return (value as string) || ''
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_RANGE = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i)
const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function YearGrid({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (y: number) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1 max-h-52 overflow-y-auto p-2">
      {YEAR_RANGE.map(y => (
        <button
          key={y}
          type="button"
          onClick={() => onSelect(y)}
          className={cn(
            'rounded px-2 py-1.5 text-center text-sm hover:bg-muted',
            selected === y && 'bg-primary text-primary-foreground hover:bg-primary/80',
          )}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

function MonthGrid({
  year,
  selectedMonth,
  onSelect,
  onYearChange,
}: {
  year: number
  selectedMonth: number | null
  onSelect: (month: number) => void
  onYearChange: (y: number) => void
}) {
  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onYearChange(year - 1)}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">{year}</span>
        <button
          type="button"
          onClick={() => onYearChange(year + 1)}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_DE.map((m, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i + 1)}
            className={cn(
              'rounded px-2 py-1.5 text-center text-sm hover:bg-muted',
              selectedMonth === i + 1 && 'bg-primary text-primary-foreground hover:bg-primary/80',
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DatePicker({
  mode,
  name,
  value,
  onChange,
  placeholder = 'Datum wählen',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [precision, setPrecision] = React.useState<Precision>(() =>
    mode === 'partial' ? inferPrecision(value as string | null) : 'day',
  )
  const [navYear, setNavYear] = React.useState<number>(() => {
    if (!value) return CURRENT_YEAR
    if (mode === 'year') return value as number
    return parseInt((value as string).split('-')[0]) || CURRENT_YEAR
  })

  const today = new Date()

  function handlePrecisionChange(p: Precision) {
    setPrecision(p)
    onChange(null)
  }

  function handleYearSelect(y: number) {
    setNavYear(y)
    if (mode === 'year') {
      onChange(y)
      setOpen(false)
    } else if (mode === 'partial' && precision === 'year') {
      onChange(`${y}-01-01`)
      setOpen(false)
    }
  }

  function handleMonthSelect(month: number) {
    const m = String(month).padStart(2, '0')
    onChange(`${navYear}-${m}-01`)
    setOpen(false)
  }

  function handleDaySelect(date: Date | undefined) {
    if (!date) { onChange(null); return }
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  function handleToday() { handleDaySelect(today) }

  function handleYesterday() {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    handleDaySelect(yesterday)
  }

  const displayText =
    value !== null && value !== undefined && value !== ''
      ? formatDisplayValue(mode, value, precision)
      : null

  const selectedDate =
    (mode === 'full' || (mode === 'partial' && precision === 'day')) && value
      ? (() => {
          const [y, m, d] = (value as string).split('-').map(Number)
          return new Date(y, m - 1, d)
        })()
      : undefined

  const partialMonthVal =
    mode === 'partial' && precision === 'month' && value
      ? parseInt((value as string).split('-')[1])
      : null

  const yearValue =
    mode === 'year'
      ? (value as number | null)
      : value
        ? parseInt((value as string).split('-')[0])
        : null

  return (
    <>
      <input type="hidden" name={name} value={toHiddenInputValue(mode, value)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'w-full justify-start text-left font-normal',
                !displayText && 'text-muted-foreground',
              )}
            />
          }
        >
          <CalendarIcon className="mr-2 size-4" />
          {displayText ?? placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {mode === 'partial' && (
            <div className="flex border-b">
              {(['year', 'month', 'day'] as Precision[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePrecisionChange(p)}
                  className={cn(
                    'flex-1 py-2 text-xs',
                    precision === p
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {p === 'year' ? 'Jahr' : p === 'month' ? 'Monat' : 'Tag'}
                </button>
              ))}
            </div>
          )}

          {(mode === 'year' || (mode === 'partial' && precision === 'year')) && (
            <YearGrid selected={yearValue} onSelect={handleYearSelect} />
          )}

          {mode === 'partial' && precision === 'month' && (
            <MonthGrid
              year={navYear}
              selectedMonth={partialMonthVal}
              onSelect={handleMonthSelect}
              onYearChange={setNavYear}
            />
          )}

          {(mode === 'full' || (mode === 'partial' && precision === 'day')) && (
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              locale={de}
              defaultMonth={selectedDate ?? new Date(navYear, 0)}
            />
          )}

          <div className="flex items-center gap-3 border-t px-3 py-2">
            {mode === 'year' && (
              <button
                type="button"
                onClick={() => { onChange(CURRENT_YEAR); setOpen(false) }}
                className="text-xs text-primary hover:underline"
              >
                Dieses Jahr
              </button>
            )}
            {(mode === 'full' || (mode === 'partial' && precision === 'day')) && (
              <>
                <button
                  type="button"
                  onClick={handleToday}
                  className="text-xs text-primary hover:underline"
                >
                  Heute
                </button>
                <button
                  type="button"
                  onClick={handleYesterday}
                  className="text-xs text-primary hover:underline"
                >
                  Gestern
                </button>
              </>
            )}
            {mode === 'partial' && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false) }}
                className="ml-auto text-xs text-muted-foreground hover:underline"
              >
                Löschen
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --run lib/__tests__/date-picker.test.tsx
```

Expected: All tests PASS.

If tests fail due to a CSS import error (`Cannot find module 'react-day-picker/style.css'`), change the import line to:
```ts
import 'react-day-picker/dist/style.css'
```

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test -- --run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ui/date-picker.tsx lib/__tests__/date-picker.test.tsx
git commit -m "feat: add DatePicker component (year/full/partial modes)"
```

---

### Task 3: Wire DatePicker into wine forms

**Files:**
- Modify: `app/wine/new/wine-form.tsx`
- Modify: `app/wine/[id]/wine-edit-sheet.tsx`

**Interfaces:**
- Consumes: `DatePicker`, `DatePickerProps` from `@/components/ui/date-picker`

- [ ] **Step 1: Update `app/wine/new/wine-form.tsx`**

Add import after the existing import block (around line 14):
```tsx
import { DatePicker } from '@/components/ui/date-picker'
```

Add two state variables after the existing `useState` declarations (after `const [purchaseLocation, setPurchaseLocation] = useState('')`, around line 32):
```tsx
const [vintage, setVintage] = useState<number | null>(null)
const [purchaseDate, setPurchaseDate] = useState<string | null>(null)
```

Replace the vintage `Input` (inside the `grid grid-cols-2` at line 106). Change only the first column's content:

```tsx
// OLD first column of the grid:
<div className="space-y-2">
  <Label htmlFor="vintage">Jahrgang</Label>
  <Input id="vintage" name="vintage" type="number" min="1900" max="2099" />
</div>

// NEW:
<div className="space-y-2">
  <Label>Jahrgang</Label>
  <DatePicker
    mode="year"
    name="vintage"
    value={vintage}
    onChange={v => setVintage(v as number | null)}
    placeholder="Jahrgang wählen"
  />
</div>
```

Replace the `purchase_date` `Input` (inside the `grid grid-cols-2` at line 150). Change only the second column's content:

```tsx
// OLD second column of the price/date grid:
<div className="space-y-2">
  <Label htmlFor="purchase_date">Kaufdatum</Label>
  <Input id="purchase_date" name="purchase_date" type="date" />
</div>

// NEW:
<div className="space-y-2">
  <Label>Kaufdatum</Label>
  <DatePicker
    mode="partial"
    name="purchase_date"
    value={purchaseDate}
    onChange={v => setPurchaseDate(v as string | null)}
    placeholder="Kaufdatum (optional)"
  />
</div>
```

- [ ] **Step 2: Update `app/wine/[id]/wine-edit-sheet.tsx`**

Add import after the existing import block:
```tsx
import { DatePicker } from '@/components/ui/date-picker'
```

Add a state variable after `const [wineType, setWineType] = useState(wine.type)` (around line 17):
```tsx
const [vintage, setVintage] = useState<number | null>(wine.vintage ?? null)
```

Replace the vintage `Input` (around lines 52–57):
```tsx
// OLD:
<div className="space-y-2">
  <Label htmlFor="vintage">Jahrgang</Label>
  <Input id="vintage" name="vintage" type="number" min="1900" max="2099"
    defaultValue={wine.vintage ?? ''} />
</div>

// NEW:
<div className="space-y-2">
  <Label>Jahrgang</Label>
  <DatePicker
    mode="year"
    name="vintage"
    value={vintage}
    onChange={v => setVintage(v as number | null)}
    placeholder="Jahrgang wählen"
  />
</div>
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/wine/new/wine-form.tsx app/wine/[id]/wine-edit-sheet.tsx
git commit -m "feat: use DatePicker for vintage and purchase_date in wine forms"
```

---

### Task 4: Wire DatePicker into trip form

**Files:**
- Modify: `app/trips/new-trip-form.tsx`

**Interfaces:**
- Consumes: `DatePicker` from `@/components/ui/date-picker`

- [ ] **Step 1: Update `app/trips/new-trip-form.tsx`**

Add import after the existing import block:
```tsx
import { DatePicker } from '@/components/ui/date-picker'
```

Add two state variables after `const [open, setOpen] = useState(false)` (around line 14):
```tsx
const [dateStart, setDateStart] = useState<string | null>(null)
const [dateEnd, setDateEnd] = useState<string | null>(null)
```

Replace the two date text inputs (the `grid grid-cols-2` block around lines 36–45):
```tsx
// OLD:
<div className="grid grid-cols-2 gap-3">
  <div className="space-y-2">
    <Label htmlFor="date_start">Beginn</Label>
    <Input id="date_start" name="date_start" type="text" inputMode="numeric" placeholder="TT.MM.JJJJ" />
  </div>
  <div className="space-y-2">
    <Label htmlFor="date_end">Ende</Label>
    <Input id="date_end" name="date_end" type="text" inputMode="numeric" placeholder="TT.MM.JJJJ" />
  </div>
</div>

// NEW:
<div className="grid grid-cols-2 gap-3">
  <div className="space-y-2">
    <Label>Beginn</Label>
    <DatePicker
      mode="full"
      name="date_start"
      value={dateStart}
      onChange={v => setDateStart(v as string | null)}
      placeholder="Beginn"
    />
  </div>
  <div className="space-y-2">
    <Label>Ende</Label>
    <DatePicker
      mode="full"
      name="date_end"
      value={dateEnd}
      onChange={v => setDateEnd(v as string | null)}
      placeholder="Ende"
    />
  </div>
</div>
```

Note: `Input` remains imported — it is still used for the `name` and `location` fields above.

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --run
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/trips/new-trip-form.tsx
git commit -m "feat: use DatePicker for trip start and end dates"
```
