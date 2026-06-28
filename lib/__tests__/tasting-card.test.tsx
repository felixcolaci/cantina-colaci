import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TastingCard } from '@/components/dashboard/tasting-card'

const baseTasting = {
  id: 't1',
  date: '2024-03-15',
  rating: 9,
  notes: 'Sehr elegant, langer Abgang.',
}

const baseWine = {
  name: 'Barolo',
  producer: 'Gaja',
  vintage: 2019,
}

describe('TastingCard', () => {
  it('renders the wine name', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the rating', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('renders the formatted date in German', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('15. März 2024')).toBeInTheDocument()
  })

  it('renders notes when present', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('Sehr elegant, langer Abgang.')).toBeInTheDocument()
  })

  it('renders no notes section when notes is null', () => {
    render(<TastingCard tasting={{ ...baseTasting, notes: null }} wine={baseWine} />)
    expect(screen.queryByText('Sehr elegant, langer Abgang.')).not.toBeInTheDocument()
  })

  it('renders without producer gracefully', () => {
    render(<TastingCard tasting={baseTasting} wine={{ ...baseWine, producer: null }} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders vintage inline with wine name', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('2019')).toBeInTheDocument()
  })
})
