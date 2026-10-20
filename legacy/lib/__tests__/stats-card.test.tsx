import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/dashboard/stats-card'

describe('StatsCard', () => {
  it('renders the title', () => {
    render(<StatsCard title="Flaschen im Keller" value={42} />)
    expect(screen.getByText('Flaschen im Keller')).toBeInTheDocument()
  })

  it('renders the numeric value', () => {
    render(<StatsCard title="Weine" value={7} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders a string value', () => {
    render(<StatsCard title="Bewertung" value="8.5" />)
    expect(screen.getByText('8.5')).toBeInTheDocument()
  })
})
