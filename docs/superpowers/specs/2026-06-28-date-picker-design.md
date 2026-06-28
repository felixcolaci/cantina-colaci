# DatePicker Component Design

**Date:** 2026-06-28
**Status:** Approved

## Overview

Replace the ad-hoc date inputs in the wine cellar app (plain number input for vintage, `type="date"` for purchase date, text input for trip dates) with a single standardized `<DatePicker>` component that covers three modes:

- `year` — year-only selection (wine vintage)
- `full` — full calendar date, all fields required (trip start/end)
- `partial` — full calendar date where each component is optional (purchase date)

The component renders a trigger button that opens a Popover. The calendar is powered by `react-day-picker` v9 with `date-fns` for locale/formatting.

## Component API

```tsx
// components/ui/date-picker.tsx

type DatePickerMode = 'year' | 'full' | 'partial'

interface DatePickerProps {
  mode: DatePickerMode
  name: string              // name of the hidden <input> for FormData
  value: number | string | null
  onChange: (value: number | string | null) => void
  placeholder?: string
}
```

Value types by mode:
- `year`: `number | null` — the year as integer
- `full`: `string | null` — ISO date string `YYYY-MM-DD`
- `partial`: `string | null` — ISO date string `YYYY-MM-DD`, with `01` substituted for unknown month/day

The component always renders a `<input type="hidden" name={name} value={...} />` so it works inside native `<form>` with `FormData` — consistent with the existing uncontrolled form pattern.

## Popover Behavior Per Mode

### `mode="year"`

- **Trigger:** Button showing the selected year or placeholder text.
- **Popover body:** A grid of recent years (~30 years back from today, 3 columns). Selected year is highlighted.
- **Popover footer:** Single quick-select button: "Dieses Jahr".
- **Output:** Hidden input value is the integer year as a string (e.g. `"2019"`).

### `mode="full"`

- **Trigger:** Button showing the formatted date (e.g. "15. März 2022") or placeholder.
- **Popover body:** `react-day-picker` in `mode="single"`, German locale, with month/year navigation in header.
- **Popover footer:** Two quick-select buttons: "Heute" and "Gestern".
- **Output:** Hidden input value is `YYYY-MM-DD`.

### `mode="partial"`

- **Trigger:** Button showing the date at the selected precision — "2022" (year), "März 2022" (month), or "15. März 2022" (day).
- **Popover header:** Precision segmented toggle: `[Jahr] [Monat] [Tag]` — defaults to `Tag`. Changing precision clears the current selection.
- **Popover body:**
  - Precision `Jahr`: Year grid (same as year mode).
  - Precision `Monat`: Month grid for a selected year — 12 month cells + year navigation arrows.
  - Precision `Tag`: Standard `react-day-picker` single calendar.
- **Popover footer:** "Heute" + "Gestern" buttons (active only at `Tag` precision). "Löschen" link to clear the value.
- **Storage mapping:**
  - Jahr only → `YYYY-01-01`
  - Jahr + Monat → `YYYY-MM-01`
  - Full → `YYYY-MM-DD`
- **Output:** Hidden input value is `YYYY-MM-DD` (with fill-in) or empty string when null.

## Data Flow

```
User picks date
      ↓
onChange(value) called in parent component state
      ↓
<input type="hidden" name={name} value={value ?? ''} />
      ↓
FormData → server action (existing parseDate / parseInt logic unchanged)
```

The server actions need no changes for `full` mode (already parse `YYYY-MM-DD`). For `partial`, the output is always a valid `YYYY-MM-DD` string (no new parsing needed). For `year`, the output is an integer string (already handled via `parseInt`).

## Display Formatting

Uses `date-fns` with `de` locale:
- Full date: `format(date, "d. MMMM yyyy", { locale: de })` → "15. März 2022"
- Month+year: `format(date, "MMMM yyyy", { locale: de })` → "März 2022"
- Year only: `String(year)` → "2022"

## Files Changed

| File | Change |
|------|--------|
| `components/ui/date-picker.tsx` | **New** — the DatePicker component |
| `app/wine/new/wine-form.tsx` | Replace `vintage` number input and `purchase_date` date input |
| `app/wine/[id]/wine-edit-sheet.tsx` | Replace `vintage` number input |
| `lib/actions/wine.ts` | No changes needed |
| `app/trips/new-trip-form.tsx` | Replace `date_start` / `date_end` text inputs |
| `lib/actions/trips.ts` | No changes needed (already parses `YYYY-MM-DD`) |
| `package.json` | Add `react-day-picker`, `date-fns` |

## Dependencies

- `react-day-picker` v9 — calendar grid component
- `date-fns` — formatting with German locale (peer dep of react-day-picker, likely already needed)

## Non-Goals

- No time/hour selection.
- No date range selection (start+end are separate `<DatePicker mode="full">` instances).
- No persistence of partial-date precision to the database (precision state lives only in the UI).
