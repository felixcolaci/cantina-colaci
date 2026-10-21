import { describe, it, expect } from 'vitest'
import { buildMcpConfigs } from '../client-config'

describe('buildMcpConfigs', () => {
  const configs = buildMcpConfigs('https://example.com', 'secret-key')

  it('embeds the MCP endpoint and key in the Claude Desktop config', () => {
    const parsed = JSON.parse(configs.claudeDesktop)
    expect(parsed.mcpServers['cantina-colaci'].url).toBe('https://example.com/api/mcp')
    expect(parsed.mcpServers['cantina-colaci'].headers.Authorization).toBe('Bearer secret-key')
  })

  it('embeds the endpoint and key in the Claude CLI command', () => {
    expect(configs.claudeCli).toContain('https://example.com/api/mcp')
    expect(configs.claudeCli).toContain('Bearer secret-key')
  })

  it('embeds the endpoint and key in the Copilot config', () => {
    const parsed = JSON.parse(configs.copilot)
    expect(parsed.servers['cantina-colaci'].url).toBe('https://example.com/api/mcp')
    expect(parsed.servers['cantina-colaci'].headers.Authorization).toBe('Bearer secret-key')
  })

  it('aliases generic to the Claude Desktop config', () => {
    expect(configs.generic).toBe(configs.claudeDesktop)
  })
})
