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
