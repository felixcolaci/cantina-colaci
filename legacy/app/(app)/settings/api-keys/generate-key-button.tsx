'use client'

import { useState } from 'react'
import { generateApiKey } from '@/lib/actions/api-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

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

  const generic = claudeDesktop

  return { claudeDesktop, claudeCli, copilot, generic }
}

const CLIENT_TABS = [
  { value: 'claudeDesktop', label: 'Claude Desktop' },
  { value: 'claudeCli', label: 'Claude Code CLI' },
  { value: 'copilot', label: 'GitHub Copilot' },
  { value: 'generic', label: 'Generisch' },
] as const

export function GenerateKeyButton() {
  const [generated, setGenerated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      const result = await generateApiKey(formData)
      setGenerated(result.key)
    } finally {
      setLoading(false)
    }
  }

  if (generated) {
    const configs = buildMcpConfigs(window.location.origin, generated)

    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800 text-base">API-Schlüssel generiert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-green-800 mb-1">
              Schlüssel kopieren — wird nicht erneut angezeigt:
            </p>
            <code className="block p-3 bg-white rounded border text-sm break-all select-all">
              {generated}
            </code>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800 mb-1">
              Config für deinen MCP-Client:
            </p>
            <Tabs defaultValue="claudeDesktop">
              <TabsList>
                {CLIENT_TABS.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CLIENT_TABS.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-2 pt-2">
                  <pre className="p-3 bg-white rounded border text-xs overflow-x-auto select-all">
                    {configs[tab.value]}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(configs[tab.value])}
                  >
                    Config kopieren
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-3 p-4 rounded-lg border">
      <h3 className="font-medium">Neuer API-Schlüssel</h3>
      <div className="space-y-2">
        <Label htmlFor="name">Name (zur Erinnerung, wo du ihn verwendest)</Label>
        <Input id="name" name="name" placeholder="Claude Desktop" required />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Generiere…' : 'API-Schlüssel generieren'}
      </Button>
    </form>
  )
}
