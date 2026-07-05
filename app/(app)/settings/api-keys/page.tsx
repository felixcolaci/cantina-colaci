import { createClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { GenerateKeyButton } from './generate-key-button'
import { RevokeKeyForm } from './revoke-key-form'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const serviceClient = createAdminClient()
  const { data: keys } = await serviceClient
    .from('api_keys')
    .select('id, name, created_at')
    .eq('family_id', membership.family_id)
    .order('created_at', { ascending: false })

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <Link href="/" className="inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Home
      </Link>
      <div>
        <h2 className="text-xl font-semibold">API-Schlüssel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verbinde Claude Desktop mit deiner Cantina für Weinempfehlungen im Gespräch.
        </p>
      </div>

      {keys && keys.length > 0 && (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  Erstellt am {new Date(k.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              {membership.role === 'owner' && <RevokeKeyForm id={k.id} name={k.name} />}
            </div>
          ))}
        </div>
      )}

      {membership.role === 'owner' && <GenerateKeyButton />}

      {membership.role !== 'owner' && (
        <p className="text-sm text-muted-foreground">
          Nur der Familienbesitzer kann API-Schlüssel verwalten.
        </p>
      )}

      <div className="p-4 rounded-lg bg-muted space-y-2">
        <h3 className="font-medium text-sm">Verwendung</h3>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>API-Schlüssel oben generieren</li>
          <li>JSON-Config in <code>~/.claude/mcp.json</code> einfügen</li>
          <li>Claude Desktop neu starten</li>
          <li>Frage Claude: &quot;Was habe ich gerade in meiner Cantina?&quot;</li>
        </ol>
      </div>
    </div>
  )
}
