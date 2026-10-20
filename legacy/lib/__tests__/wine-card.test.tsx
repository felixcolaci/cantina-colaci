import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WineCard } from '@/components/cellar/wine-card'

const baseWine = {
  id: '1',
  name: 'Barolo',
  producer: 'Gaja',
  type: 'red' as const,
  vintage: 2019,
  region: null,
  country: null,
  grape_variety: null,
  notes: null,
  cellar_id: 'c1',
  created_at: '2024-01-01',
}

const baseEntries = [{ quantity: 3 }]

describe('WineCard', () => {
  it('renders the wine name', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} vintage={null} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} vintage={null} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the total bottle count', () => {
    render(<WineCard wine={baseWine} entries={[{ quantity: 2 }, { quantity: 1 }]} vintage={null} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders the type badge label for red wine', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} vintage={null} />)
    expect(screen.getByText('Rotwein')).toBeInTheDocument()
  })

  it('renders the type badge label for white wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'white' }} entries={baseEntries} vintage={null} />)
    expect(screen.getByText('Weißwein')).toBeInTheDocument()
  })

  it('renders the type badge label for sparkling wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'sparkling' }} entries={baseEntries} vintage={null} />)
    expect(screen.getByText('Schaumwein')).toBeInTheDocument()
  })

  it('renders the type badge label for rosé wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'rosé' }} entries={baseEntries} vintage={null} />)
    expect(screen.getByText('Rosé')).toBeInTheDocument()
  })

  it('renders an img when a photoUrl is provided (already resolved by the server)', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} vintage={null} photoUrl="https://example.com/photo.jpg" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders no img when photoUrl is null', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} vintage={null} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
