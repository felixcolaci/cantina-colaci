# Cantina Colaci MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP server endpoint to Cantina Colaci so Claude can query your wine cellar during any conversation and recommend pairings from your actual stock.

**Architecture:** Next.js Route Handler at `/api/mcp` implementing Streamable HTTP transport. Auth via hashed personal API key stored in a new `api_keys` Supabase table. One MCP tool: `get_cellar_wines`. UI page at `/settings/api-keys` to generate and revoke keys with a ready-to-copy Claude Desktop config snippet.

**Tech Stack:** `@modelcontextprotocol/sdk`, `@supabase/supabase-js` (service role), Next.js Route Handler, TypeScript, Vitest

---

## File Map

```
supabase/migrations/
  004_api_keys.sql                       # api_keys table (no RLS, service role only)

lib/
  types.ts                               # Add ApiKey type
  mcp/
    server.ts                            # MCP Server instance with get_cellar_wines tool
    auth.ts                              # Validate Bearer token → family_id
  supabase/
    service.ts                           # Supabase client using service role key

app/
  api/
    mcp/
      route.ts                           # POST handler — Streamable HTTP MCP transport
  settings/
    api-keys/
      page.tsx                           # List + revoke keys (server)
      generate-key-button.tsx            # Generate key, show once (client)
      revoke-key-form.tsx                # Revoke key form (client)
  
lib/actions/
  api-keys.ts                            # generateApiKey, revokeApiKey server actions

components/nav/
  top-bar.tsx                            # Add "API Keys" link to dropdown
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/004_api_keys.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/004_api_keys.sql`:

```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now()
);
```

No RLS — this table is only accessed server-side via the service role key, never from the browser client.

- [ ] **Step 2: Apply migration**

In Supabase dashboard → SQL Editor: paste and run.

Verify in Table Editor: `api_keys` table exists with the four columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_api_keys.sql
git commit -m "feat: add api_keys table for MCP authentication"
```

---

## Task 2: Install MCP SDK & Service Role Client

**Files:**
- Create: `lib/supabase/service.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Install MCP SDK**

```bash
npm install @modelcontextprotocol/sdk
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to environment**

Add to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get it from: Supabase dashboard → Settings → API → `service_role` key.

Add to `.env.local.example`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add to Vercel project environment variables (same key, same value).

- [ ] **Step 3: Create `lib/supabase/service.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS, server-side only
// NEVER import this in client components or expose to the browser
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 4: Add `ApiKey` type to `lib/types.ts`**

```typescript
export interface ApiKey {
  id: string
  family_id: string
  name: string
  key_hash: string
  created_at: string
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/service.ts lib/types.ts .env.local.example
git commit -m "feat: add Supabase service role client and ApiKey type"
```

---

## Task 3: MCP Auth & Server Logic

**Files:**
- Create: `lib/mcp/auth.ts`
- Create: `lib/mcp/server.ts`
- Create: `lib/__tests__/mcp-auth.test.ts`

- [ ] **Step 1: Write `lib/mcp/auth.ts`**

```typescript
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function resolveFamilyId(bearerToken: string): Promise<string | null> {
  const supabase = createServiceClient()
  const keyHash = hashKey(bearerToken)

  const { data } = await supabase
    .from('api_keys')
    .select('family_id')
    .eq('key_hash', keyHash)
    .maybeSingle()

  return data?.family_id ?? null
}
```

- [ ] **Step 2: Write test for `hashKey`**

Create `lib/__tests__/mcp-auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hashKey } from '../mcp/auth'

describe('hashKey', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashKey('test-api-key-123')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('is deterministic', () => {
    expect(hashKey('same-key')).toBe(hashKey('same-key'))
  })

  it('produces different hashes for different keys', () => {
    expect(hashKey('key-a')).not.toBe(hashKey('key-b'))
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- lib/__tests__/mcp-auth.test.ts
```

Expected: `3 tests passed`

- [ ] **Step 4: Write `lib/mcp/server.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createServiceClient } from '@/lib/supabase/service'

export function createMcpServer(familyId: string): McpServer {
  const server = new McpServer({
    name: 'cantina-colaci',
    version: '1.0.0',
  })

  server.tool(
    'get_cellar_wines',
    'Returns all wines currently in stock in the family cellar. Use this to recommend wine pairings from the actual collection.',
    {},
    async () => {
      const supabase = createServiceClient()

      const { data: cellar } = await supabase
        .from('cellars')
        .select('id')
        .eq('family_id', familyId)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!cellar) {
        return {
          content: [{ type: 'text', text: JSON.stringify([]) }],
        }
      }

      const { data: wines } = await supabase
        .from('wines')
        .select(`
          name, producer, vintage, type, region, country, grape_variety, notes,
          cellar_entries!inner(quantity, status, storage_locations(name))
        `)
        .eq('cellar_id', cellar.id)
        .eq('cellar_entries.status', 'in_stock')
        .gt('cellar_entries.quantity', 0)
        .order('name')

      const result = (wines ?? []).map(wine => {
        const entries = wine.cellar_entries as any[]
        const totalQuantity = entries.reduce((sum: number, e: any) => sum + e.quantity, 0)
        const location = entries[0]?.storage_locations?.name ?? null

        return {
          name: wine.name,
          producer: wine.producer,
          vintage: wine.vintage,
          type: wine.type,
          region: wine.region,
          country: wine.country,
          grape_variety: wine.grape_variety,
          notes: wine.notes,
          quantity: totalQuantity,
          storage_location: location,
        }
      })

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  return server
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/ lib/__tests__/mcp-auth.test.ts
git commit -m "feat: add MCP server logic and API key auth"
```

---

## Task 4: MCP Route Handler

**Files:**
- Create: `app/api/mcp/route.ts`

- [ ] **Step 1: Create `app/api/mcp/route.ts`**

```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { resolveFamilyId } from '@/lib/mcp/auth'
import { createMcpServer } from '@/lib/mcp/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const familyId = await resolveFamilyId(token)
  if (!familyId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const server = createMcpServer(familyId)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  await server.connect(transport)

  const body = await request.json()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  transport.onmessage = async (message) => {
    const text = JSON.stringify(message)
    await writer.write(new TextEncoder().encode(text + '\n'))
    await writer.close()
  }

  await transport.handleRequest(body, {}, async (response) => {
    const text = JSON.stringify(response)
    return new NextResponse(text, {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

Note: The exact MCP SDK API for Next.js Route Handlers depends on the installed SDK version. Check `node_modules/@modelcontextprotocol/sdk/server/` for available transports. The pattern above follows the Streamable HTTP spec — adjust if the SDK exposes a simpler `handleHTTPRequest` helper.

- [ ] **Step 2: Verify the route starts**

```bash
npm run dev
```

Send a test request:
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-key" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Expected response: `401 Unauthorized`

- [ ] **Step 3: Commit**

```bash
git add app/api/mcp/
git commit -m "feat: add MCP route handler with Streamable HTTP transport"
```

---

## Task 5: API Key Management UI

**Files:**
- Create: `lib/actions/api-keys.ts`
- Create: `app/settings/api-keys/page.tsx`
- Create: `app/settings/api-keys/generate-key-button.tsx`
- Create: `app/settings/api-keys/revoke-key-form.tsx`
- Modify: `components/nav/top-bar.tsx`

- [ ] **Step 1: Create `lib/actions/api-keys.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashKey } from '@/lib/mcp/auth'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'

export async function generateApiKey(formData: FormData): Promise<{ key: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw new Error('Solo il proprietario può generare API key')
  }

  const key = randomUUID()
  const serviceClient = createServiceClient()

  await serviceClient.from('api_keys').insert({
    family_id: membership.family_id,
    name: formData.get('name') as string,
    key_hash: hashKey(key),
  })

  return { key }
}

export async function revokeApiKey(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  const serviceClient = createServiceClient()
  await serviceClient.from('api_keys').delete().eq('id', id)

  redirect('/settings/api-keys')
}
```

- [ ] **Step 2: Create `app/settings/api-keys/generate-key-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { generateApiKey } from '@/lib/actions/api-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function GenerateKeyButton() {
  const [generated, setGenerated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = await generateApiKey(formData)
    setGenerated(result.key)
    setLoading(false)
  }

  if (generated) {
    const config = JSON.stringify({
      mcpServers: {
        'cantina-colaci': {
          url: `${window.location.origin}/api/mcp`,
          headers: { Authorization: `Bearer ${generated}` },
        },
      },
    }, null, 2)

    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800 text-base">✓ API Key generata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-green-800 mb-1">
              Copia la key — non verrà mostrata di nuovo:
            </p>
            <code className="block p-3 bg-white rounded border text-sm break-all select-all">
              {generated}
            </code>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800 mb-1">
              Config per Claude Desktop (<code>~/.claude/mcp.json</code>):
            </p>
            <pre className="p-3 bg-white rounded border text-xs overflow-x-auto select-all">
              {config}
            </pre>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(config)}
          >
            Copia config
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-3 p-4 rounded-lg border">
      <h3 className="font-medium">Nuova API Key</h3>
      <div className="space-y-2">
        <Label htmlFor="name">Nome (per ricordarti dove la usi)</Label>
        <Input id="name" name="name" placeholder="Claude Desktop" required />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Generazione…' : 'Genera API Key'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/settings/api-keys/revoke-key-form.tsx`**

```tsx
'use client'

import { revokeApiKey } from '@/lib/actions/api-keys'
import { Button } from '@/components/ui/button'

export function RevokeKeyForm({ id, name }: { id: string; name: string }) {
  return (
    <form action={revokeApiKey}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
      >
        Revoca
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Create `app/settings/api-keys/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { GenerateKeyButton } from './generate-key-button'
import { RevokeKeyForm } from './revoke-key-form'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const serviceClient = createServiceClient()
  const { data: keys } = await serviceClient
    .from('api_keys')
    .select('id, name, created_at')
    .eq('family_id', membership.family_id)
    .order('created_at', { ascending: false })

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold">API Keys</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connetti Claude Desktop alla tua cantina per ricevere consigli sui vini durante le conversazioni.
        </p>
      </div>

      {/* Existing keys */}
      {keys && keys.length > 0 && (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  Creata il {new Date(k.created_at).toLocaleDateString('it-IT')}
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
          Solo il proprietario della famiglia può gestire le API key.
        </p>
      )}

      {/* Instructions */}
      <div className="p-4 rounded-lg bg-muted space-y-2">
        <h3 className="font-medium text-sm">Come usarla</h3>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Genera una API Key qui sopra</li>
          <li>Copia la config JSON nel file <code>~/.claude/mcp.json</code></li>
          <li>Riavvia Claude Desktop</li>
          <li>Chatta con Claude: "Cosa ho in cantina che va con una bistecca?"</li>
        </ol>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add link to top bar dropdown**

In `components/nav/top-bar.tsx`, add inside the `DropdownMenuContent`:

```tsx
<DropdownMenuItem asChild>
  <Link href="/settings/api-keys">API Keys</Link>
</DropdownMenuItem>
```

- [ ] **Step 6: Commit**

```bash
git add app/settings/api-keys/ lib/actions/api-keys.ts components/nav/top-bar.tsx
git commit -m "feat: add API key management UI for MCP integration"
```

---

## Task 6: End-to-End Test

- [ ] **Step 1: Generate a key**

Run `npm run dev`. Go to profile menu → API Keys → generate key named "Test".

- [ ] **Step 2: Test auth failure**

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-key" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Expected: `401 Unauthorized`

- [ ] **Step 3: Test tools/list**

Replace `<YOUR-KEY>` with the generated key:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-KEY>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Expected: JSON response listing `get_cellar_wines` tool.

- [ ] **Step 4: Test get_cellar_wines**

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-KEY>" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_cellar_wines","arguments":{}},"id":2}'
```

Expected: JSON array of wines currently in your cellar.

- [ ] **Step 5: Configure Claude Desktop**

Copy the config snippet from the API Keys page into `~/.claude/mcp.json`. Restart Claude Desktop.

In a new Claude conversation, ask: *"Was habe ich gerade in meiner Cantina?"* — Claude should call `get_cellar_wines` and list your actual wines.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: MCP end-to-end test fixes"
git push origin main
```

---

## Run all tests

```bash
npm run test:run
```

Expected: `8 tests passed` (5 existing + 3 new mcp-auth tests)
