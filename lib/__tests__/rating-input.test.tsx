import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RatingInput } from '@/components/ui/rating-input'

describe('RatingInput', () => {
  it('renders 5 buttons', () => {
    render(<RatingInput name="rating" value={null} onChange={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('renders buttons labeled 1 through 5', () => {
    render(<RatingInput name="rating" value={null} onChange={() => {}} />)
    ;[1, 2, 3, 4, 5].forEach(n => {
      expect(screen.getByText(String(n))).toBeInTheDocument()
    })
  })

  it('calls onChange with the clicked value', () => {
    const onChange = vi.fn()
    render(<RatingInput name="rating" value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('4'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('renders a hidden input with the current value', () => {
    const { container } = render(<RatingInput name="rating" value={3} onChange={() => {}} />)
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement
    expect(hidden.name).toBe('rating')
    expect(hidden.value).toBe('3')
  })

  it('renders empty hidden input when value is null', () => {
    const { container } = render(<RatingInput name="rating" value={null} onChange={() => {}} />)
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement
    expect(hidden.value).toBe('')
  })

  it('marks the selected button as active (aria-pressed)', () => {
    render(<RatingInput name="rating" value={3} onChange={() => {}} />)
    expect(screen.getByText('3').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })
})
