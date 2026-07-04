import { describe, it, expect } from 'vitest'
import { buildMcpConfigs } from '@/app/(app)/settings/api-keys/generate-key-button'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { GenerateKeyButton } from '@/app/(app)/settings/api-keys/generate-key-button'

vi.mock('@/lib/actions/api-keys', () => ({
  generateApiKey: vi.fn().mockResolvedValue({ key: 'generated-key-456' }),
}))

describe('buildMcpConfigs', () => {
  const origin = 'https://cantina.example.com'
  const key = 'test-key-123'

  it('builds the Claude Desktop config with mcpServers and a Bearer header', () => {
    const { claudeDesktop } = buildMcpConfigs(origin, key)
    expect(JSON.parse(claudeDesktop)).toEqual({
      mcpServers: {
        'cantina-colaci': {
          url: 'https://cantina.example.com/api/mcp',
          headers: { Authorization: 'Bearer test-key-123' },
        },
      },
    })
  })

  it('builds the Claude Code CLI command', () => {
    const { claudeCli } = buildMcpConfigs(origin, key)
    expect(claudeCli).toBe(
      'claude mcp add --transport http cantina-colaci https://cantina.example.com/api/mcp --header "Authorization: Bearer test-key-123"'
    )
  })

  it('builds the GitHub Copilot config with servers and type "http"', () => {
    const { copilot } = buildMcpConfigs(origin, key)
    expect(JSON.parse(copilot)).toEqual({
      servers: {
        'cantina-colaci': {
          type: 'http',
          url: 'https://cantina.example.com/api/mcp',
          headers: { Authorization: 'Bearer test-key-123' },
        },
      },
    })
  })

  it('builds the generic config identical to the Claude Desktop config', () => {
    const configs = buildMcpConfigs(origin, key)
    expect(configs.generic).toBe(configs.claudeDesktop)
  })
})

describe('GenerateKeyButton', () => {
  async function generateKey() {
    render(<GenerateKeyButton />)
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Claude Desktop' } })
    fireEvent.click(screen.getByRole('button', { name: /API-Schlüssel generieren/ }))
    await waitFor(() => screen.getByText('generated-key-456'))
  }

  it('defaults to the Claude Desktop tab showing mcpServers JSON', async () => {
    await generateKey()
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument()
  })

  it('shows the Claude Code CLI command on that tab', async () => {
    await generateKey()
    fireEvent.click(screen.getByRole('tab', { name: 'Claude Code CLI' }))
    expect(screen.getByText(/claude mcp add --transport http/)).toBeInTheDocument()
  })

  it('shows the GitHub Copilot config with a servers key on that tab', async () => {
    await generateKey()
    fireEvent.click(screen.getByRole('tab', { name: 'GitHub Copilot' }))
    expect(screen.getByText(/"servers"/)).toBeInTheDocument()
  })

  it('copies the active tab\'s config to the clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } })
    await generateKey()
    fireEvent.click(screen.getByRole('tab', { name: 'Claude Code CLI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Config kopieren' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('claude mcp add --transport http')
    )
  })
})
