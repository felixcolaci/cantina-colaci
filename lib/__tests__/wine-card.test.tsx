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
  grape_variety: null,
  notes: null,
  cellar_id: 'c1',
  created_at: '2024-01-01',
}

const baseEntries = [{ quantity: 3, photo_url: null }]

describe('WineCard', () => {
  it('renders the wine name', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the total bottle count', () => {
    render(<WineCard wine={baseWine} entries={[{ quantity: 2, photo_url: null }, { quantity: 1, photo_url: null }]} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders the type badge label for red wine', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.getByText('Rotwein')).toBeInTheDocument()
  })

  it('renders the type badge label for white wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'white' }} entries={baseEntries} />)
    expect(screen.getByText('Weißwein')).toBeInTheDocument()
  })

  it('renders the type badge label for sparkling wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'sparkling' }} entries={baseEntries} />)
    expect(screen.getByText('Schaumwein')).toBeInTheDocument()
  })

  it('renders an img when photo_url is provided', () => {
    render(<WineCard wine={baseWine} entries={[{ quantity: 1, photo_url: 'https://example.com/photo.jpg' }]} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders no img when no photo_url', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
