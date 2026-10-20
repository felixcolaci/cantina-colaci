import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TastingCard } from '@/components/dashboard/tasting-card'

// Regression coverage for review finding 5.2: the DB constraint on
// tastings.rating was fixed to 1-5 (supabase/migrations) to match the only
// input that writes it (components/ui/rating-input.tsx, which — per
// lib/__tests__/rating-input.test.tsx — renders exactly 5 options, 1
// through 5). This file asserts the display side agrees: every rating
// rating-input.tsx can actually produce renders as "n/5" here, not just "n"
// (a value outside 1-5, like the demo seed data's old 7/8 ratings, would
// still render fine but would read nonsensically against the hardcoded
// "/5" suffix — see app/(app)/wine/[id]/page.tsx:266-269 for the same
// "/5" suffix pattern this component shares).

const baseWine = {
  name: 'Barolo',
  producer: 'Gaja',
  vintage: 2019,
}

describe('TastingCard rating display', () => {
  it.each([1, 2, 3, 4, 5])('renders a rating of %d as "%d/5"', (rating) => {
    render(
      <TastingCard
        tasting={{ id: 't1', date: '2024-03-15', rating, notes: null }}
        wine={baseWine}
      />
    )

    const suffix = screen.getByText('/5')
    expect(suffix.parentElement?.textContent).toBe(`${rating}/5`)
  })
})
