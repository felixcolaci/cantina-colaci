import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/components/nav/bottom-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('BottomNav', () => {
  it('renders all four nav items', () => {
    render(<BottomNav />)
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('Keller')).toBeInTheDocument()
    expect(screen.getByLabelText('Reisen')).toBeInTheDocument()
    expect(screen.getByLabelText('Geschichte')).toBeInTheDocument()
  })

  it('renders as a nav element', () => {
    render(<BottomNav />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
