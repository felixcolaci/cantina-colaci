import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripCard } from '@/components/trips/trip-card'

const baseTrip = {
  id: 'trip-1',
  name: 'Weinreise Toskana',
  location: 'Toskana, Italien',
  date_start: '2024-05-12',
  date_end: '2024-05-18',
}

describe('TripCard', () => {
  it('renders the trip name', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('Weinreise Toskana')).toBeInTheDocument()
  })

  it('renders the location', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('Toskana, Italien')).toBeInTheDocument()
  })

  it('renders the wine count', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders formatted date range', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('12.05.2024 → 18.05.2024')).toBeInTheDocument()
  })

  it('renders only start date when end is null', () => {
    render(<TripCard trip={{ ...baseTrip, date_end: null }} wineCount={3} />)
    expect(screen.getByText('12.05.2024')).toBeInTheDocument()
  })

  it('renders no date when both are null', () => {
    render(<TripCard trip={{ ...baseTrip, date_start: null, date_end: null }} wineCount={2} />)
    expect(screen.queryByText(/\d{2}\.\d{2}\.\d{4}/)).not.toBeInTheDocument()
  })

  it('renders no location when null', () => {
    render(<TripCard trip={{ ...baseTrip, location: null }} wineCount={1} />)
    expect(screen.queryByText('Toskana, Italien')).not.toBeInTheDocument()
  })

  it('links to the trip detail page', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trips/trip-1')
  })

  it('renders "Weine" label', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('Weine')).toBeInTheDocument()
  })
})
