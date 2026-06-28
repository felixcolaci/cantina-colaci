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
