// Pure string-building for the one-time key-reveal screen
// (app/app/api-keys-screen.tsx) -- ported 1:1 from legacy's
// buildMcpConfigs (legacy/app/(app)/settings/api-keys/generate-key-button.tsx).
// Not part of lib/mcp/auth.ts's actual server-side auth/verification path.
export function buildMcpConfigs(origin: string, key: string) {
  const url = `${origin}/api/mcp`

  const claudeDesktop = JSON.stringify({
    mcpServers: {
      'cantina-colaci': {
        url,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2)

  const claudeCli = `claude mcp add --transport http cantina-colaci ${url} --header "Authorization: Bearer ${key}"`

  const copilot = JSON.stringify({
    servers: {
      'cantina-colaci': {
        type: 'http',
        url,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }, null, 2)

  return { claudeDesktop, claudeCli, copilot, generic: claudeDesktop }
}

export const MCP_CLIENT_TABS = [
  { value: 'claudeDesktop', label: 'Claude Desktop' },
  { value: 'claudeCli', label: 'Claude Code CLI' },
  { value: 'copilot', label: 'GitHub Copilot' },
  { value: 'generic', label: 'Generisch' },
] as const
