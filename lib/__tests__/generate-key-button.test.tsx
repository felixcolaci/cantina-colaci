import { describe, it, expect } from 'vitest'
import { buildMcpConfigs } from '@/app/(app)/settings/api-keys/generate-key-button'

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
