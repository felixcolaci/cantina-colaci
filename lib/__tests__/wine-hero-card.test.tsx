import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WineHeroCard } from '@/components/dashboard/wine-hero-card'

const baseWine = {
  id: 'w1',
  name: 'Barolo',
  producer: 'Gaja',
  vintage: 2019,
  type: 'red' as const,
}

describe('WineHeroCard', () => {
  it('renders the wine name', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the vintage', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('2019')).toBeInTheDocument()
  })

  it('renders the type badge label', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('Rotwein')).toBeInTheDocument()
  })

  it('renders Weißwein for white wine', () => {
    render(<WineHeroCard wine={{ ...baseWine, type: 'white' }} />)
    expect(screen.getByText('Weißwein')).toBeInTheDocument()
  })

  it('links to the wine detail page', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/wine/w1')
  })

  it('renders without producer gracefully', () => {
    render(<WineHeroCard wine={{ ...baseWine, producer: null }} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders without vintage gracefully', () => {
    render(<WineHeroCard wine={{ ...baseWine, vintage: null }} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })
})
