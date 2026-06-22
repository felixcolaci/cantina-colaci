import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox } from '@/components/ui/combobox'

const OPTIONS = ['Toskana', 'Piemont', 'Venetien']

describe('Combobox', () => {
  it('renders a hidden input with the current value', () => {
    render(
      <Combobox name="region" value="Toskana" onChange={() => {}} options={OPTIONS} />
    )
    const hidden = document.querySelector('input[type="hidden"][name="region"]') as HTMLInputElement
    expect(hidden).not.toBeNull()
    expect(hidden.value).toBe('Toskana')
  })

  it('shows placeholder when value is empty', () => {
    render(
      <Combobox name="region" value="" onChange={() => {}} options={OPTIONS} placeholder="Region wählen" />
    )
    expect(screen.getByText('Region wählen')).toBeInTheDocument()
  })

  it('calls onChange when an option is selected', async () => {
    const onChange = vi.fn()
    render(
      <Combobox name="region" value="" onChange={onChange} options={OPTIONS} />
    )
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByText('Toskana'))
    expect(onChange).toHaveBeenCalledWith('Toskana')
  })

  it('is disabled when disabled prop is set', () => {
    render(
      <Combobox name="region" value="" onChange={() => {}} options={OPTIONS} disabled />
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
