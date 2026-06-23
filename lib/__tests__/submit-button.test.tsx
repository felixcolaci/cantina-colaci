import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubmitButton } from '@/components/ui/submit-button'

describe('SubmitButton', () => {
  it('renders children', () => {
    render(<SubmitButton isPending={false}>Wein hinzufügen</SubmitButton>)
    expect(screen.getByText('Wein hinzufügen')).toBeInTheDocument()
  })

  it('is not disabled when isPending is false', () => {
    render(<SubmitButton isPending={false}>Speichern</SubmitButton>)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('is disabled when isPending is true', () => {
    render(<SubmitButton isPending={true}>Speichern</SubmitButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows a spinner when isPending is true', () => {
    render(<SubmitButton isPending={true}>Speichern</SubmitButton>)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('does not show a spinner when isPending is false', () => {
    render(<SubmitButton isPending={false}>Speichern</SubmitButton>)
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('has type="submit"', () => {
    render(<SubmitButton isPending={false}>Speichern</SubmitButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})
