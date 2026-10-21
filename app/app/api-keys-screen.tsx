'use client'

import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useQuery as useRQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiMutate, ApiError } from '@/lib/spa/api-client'
import { buildMcpConfigs, MCP_CLIENT_TABS } from '@/lib/mcp/client-config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SubmitButton } from '@/components/ui/submit-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type ApiKeySummary = { id: string; name: string; createdAt: string }
type ApiKeysResponse = { keys: ApiKeySummary[] }
type FamilyResponse = { familyName: string; isDemo: boolean; role: string }

function RevealedKey({ generatedKey, onDone }: { generatedKey: string; onDone: () => void }) {
  const configs = buildMcpConfigs(window.location.origin, generatedKey)

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
          <code className="block p-3 bg-white rounded border text-sm break-all select-all">{generatedKey}</code>
        </div>
        <div>
          <p className="text-sm font-medium text-green-800 mb-1">Config für deinen MCP-Client:</p>
          <Tabs defaultValue="claudeDesktop">
            <TabsList>
              {MCP_CLIENT_TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
            {MCP_CLIENT_TABS.map(tab => (
              <TabsContent key={tab.value} value={tab.value} className="space-y-2 pt-2">
                <pre className="p-3 bg-white rounded border text-xs overflow-x-auto select-all">
                  {configs[tab.value]}
                </pre>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(configs[tab.value])}>
                  Config kopieren
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </div>
        <Button variant="outline" size="sm" onClick={onDone}>Fertig</Button>
      </CardContent>
    </Card>
  )
}

function GenerateKeyForm({ onGenerated }: { onGenerated: (key: string) => void }) {
  const [name, setName] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      const result = await apiMutate<{ key: string }>('POST', '/api-keys', { name })
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setName('')
      onGenerated(result!.key)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Generieren fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg" style={{ border: '1px solid var(--border)' }}>
      <h3 className="font-medium">Neuer API-Schlüssel</h3>
      <div className="space-y-2">
        <Label htmlFor="ak-name">Name (zur Erinnerung, wo du ihn verwendest)</Label>
        <Input id="ak-name" placeholder="Claude Desktop" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
      <SubmitButton isPending={isPending} size="sm">API-Schlüssel generieren</SubmitButton>
    </form>
  )
}

export function ApiKeysScreen() {
  const queryClient = useQueryClient()
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const { data: family } = useRQuery<FamilyResponse>({
    queryKey: ['family'],
    queryFn: () => apiGet<FamilyResponse>('/family'),
  })
  const { data, isLoading, error } = useRQuery<ApiKeysResponse>({
    queryKey: ['api-keys'],
    queryFn: () => apiGet<ApiKeysResponse>('/api-keys'),
  })

  async function handleRevoke(id: string) {
    setRevokingId(id)
    try {
      await apiMutate('DELETE', `/api-keys/${id}`)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    } finally {
      setRevokingId(null)
    }
  }

  const isOwner = family?.role === 'owner'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <Link to="/settings/cellar" className="inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Einstellungen
      </Link>

      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)', margin: 0 }}>
          API-Schlüssel
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Verbinde Claude Desktop mit deiner Cantina für Weinempfehlungen im Gespräch.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : error || !data ? (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          {error instanceof ApiError ? error.message : 'Schlüssel konnten nicht geladen werden.'}
        </p>
      ) : data.keys.length > 0 ? (
        <div className="space-y-2">
          {data.keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <div>
                <p className="font-medium text-sm">{k.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Erstellt am {new Date(k.createdAt).toLocaleDateString('de-DE')}
                </p>
              </div>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(k.id)}
                  disabled={revokingId === k.id}
                  style={{ color: 'var(--destructive)' }}
                >
                  {revokingId === k.id ? 'Widerrufe…' : 'Widerrufen'}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {isOwner ? (
        revealedKey ? (
          <RevealedKey generatedKey={revealedKey} onDone={() => setRevealedKey(null)} />
        ) : (
          <GenerateKeyForm onGenerated={setRevealedKey} />
        )
      ) : (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Nur der Familienbesitzer kann API-Schlüssel verwalten.
        </p>
      )}

      <div className="p-4 rounded-lg space-y-2" style={{ background: 'var(--muted)' }}>
        <h3 className="font-medium text-sm">Verwendung</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside" style={{ color: 'var(--muted-foreground)' }}>
          <li>API-Schlüssel oben generieren</li>
          <li>JSON-Config in <code>~/.claude/mcp.json</code> einfügen</li>
          <li>Claude Desktop neu starten</li>
          <li>Frage Claude: &quot;Was habe ich gerade in meiner Cantina?&quot;</li>
        </ol>
      </div>
    </div>
  )
}
