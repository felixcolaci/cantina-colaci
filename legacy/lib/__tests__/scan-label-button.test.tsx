import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ScanLabelButton } from '@/components/cellar/scan-label-button'
import { scanWineLabel } from '@/lib/actions/scan-label'

vi.mock('@/lib/actions/scan-label', () => ({
  scanWineLabel: vi.fn(),
}))

vi.mock('@/lib/image-compress', () => ({
  compressImage: vi.fn(async (file: File) => file),
}))

vi.mock('@/lib/offline/location-cache', () => ({
  readLocationCache: vi.fn(() => []),
}))

vi.mock('@/lib/offline/db', () => ({
  queueScan: vi.fn(),
}))

function selectLabelPhoto(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['label'], 'label.jpg', { type: 'image/jpeg' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ScanLabelButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a success message after a successful scan', async () => {
    vi.mocked(scanWineLabel).mockResolvedValue({ name: 'Barolo' })
    const onResult = vi.fn()
    const { container } = render(<ScanLabelButton onResult={onResult} />)

    selectLabelPhoto(container)

    await waitFor(() => expect(screen.getByText('Etikett erkannt ✓')).toBeInTheDocument())
    expect(onResult).toHaveBeenCalledWith({ name: 'Barolo' })
  })
})
