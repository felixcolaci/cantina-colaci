# Monorepo & Admin Backoffice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo as a Turborepo monorepo, move the PWA to `apps/web`, extract shared types and Supabase clients into packages, and build an admin backoffice at `apps/admin` for managing families, plans, and feature flags.

**Architecture:** pnpm workspaces + Turborepo. Two Next.js 15 apps share `@cantina/types` and `@cantina/supabase` packages. Admin app uses service role client for all writes, restricted to admin emails via magic link auth.

**Tech Stack:** Turborepo, pnpm workspaces, Next.js 15 (App Router), Supabase, shadcn/ui, TypeScript

---

## File Map (target state)

```
cantina-colaci/
├── apps/
│   ├── web/                           ← current app (moved)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/                       ← local lib (flags.ts, actions/, image-compress.ts)
│   │   ├── public/
│   │   ├── sw.ts
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── admin/                         ← new app
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx               ← dashboard
│       │   ├── (auth)/login/
│       │   │   ├── page.tsx
│       │   │   └── login-form.tsx
│       │   ├── auth/callback/route.ts
│       │   ├── families/
│       │   │   ├── page.tsx           ← list all families
│       │   │   └── [id]/page.tsx      ← family detail + flag overrides
│       │   └── flags/page.tsx         ← global flag overview
│       ├── components/
│       │   └── ui/                    ← own shadcn install
│       ├── lib/
│       │   └── actions/
│       │       └── admin.ts           ← setFlagOverride, changePlan, revokeApiKey
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── types/
│   │   ├── index.ts                   ← all shared interfaces
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── supabase/
│       ├── client.ts                  ← createBrowserClient()
│       ├── server.ts                  ← createServerClient()
│       ├── service.ts                 ← createServiceClient()
│       ├── package.json
│       └── tsconfig.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Task 1: Set Up Monorepo Root

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: root `package.json`

- [ ] **Step 1: Install pnpm (if not already installed)**

```bash
npm install -g pnpm
```

Verify: `pnpm --version` prints a version number.

- [ ] **Step 2: Create `pnpm-workspace.yaml` at repo root**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "cantina-colaci-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 5: Install Turborepo**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json
git commit -m "feat: set up Turborepo monorepo root"
```

---

## Task 2: Move Web App to `apps/web`

- [ ] **Step 1: Create `apps/` directory and move current app**

```bash
mkdir -p apps
git mv app apps/web/app
git mv components apps/web/components
git mv lib apps/web/lib
git mv public apps/web/public
git mv supabase apps/web/supabase
git mv middleware.ts apps/web/middleware.ts
git mv next.config.ts apps/web/next.config.ts
git mv sw.ts apps/web/sw.ts
git mv tailwind.config.ts apps/web/tailwind.config.ts
git mv postcss.config.mjs apps/web/postcss.config.mjs
git mv tsconfig.json apps/web/tsconfig.json
git mv vitest.config.ts apps/web/vitest.config.ts
git mv vitest.setup.ts apps/web/vitest.setup.ts
git mv package.json apps/web/package.json
```

- [ ] **Step 2: Update `apps/web/package.json`**

Change `"name"` to `"@cantina/web"` and add workspace dependencies (to be added in Task 3):

```json
{
  "name": "@cantina/web",
  ...
}
```

- [ ] **Step 3: Update `apps/web/tsconfig.json` paths**

Ensure `"@/*"` still resolves to the web app root:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 4: Verify web app still builds**

```bash
cd apps/web && pnpm install && pnpm build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move web app to apps/web"
```

---

## Task 3: Extract `packages/types`

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/index.ts`
- Modify: `apps/web/lib/types.ts` → re-export from package

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@cantina/types",
  "version": "0.0.1",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts"
}
```

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true
  }
}
```

- [ ] **Step 3: Create `packages/types/index.ts`**

Copy the full contents of `apps/web/lib/types.ts` here (all interfaces and type aliases: `WineType`, `EntryStatus`, `FamilyRole`, `StorageLocationType`, `Plan`, `FlagName`, `FeatureFlags`, `Family`, `FamilyMember`, `Cellar`, `Wine`, `CellarEntry`, `Tasting`, `Trip`, `StorageLocation`, `ApiKey`).

- [ ] **Step 4: Update `apps/web/lib/types.ts` to re-export**

Replace the file contents with:

```typescript
export * from '@cantina/types'
```

- [ ] **Step 5: Add `@cantina/types` to `apps/web/package.json`**

```json
"dependencies": {
  "@cantina/types": "workspace:*",
  ...
}
```

- [ ] **Step 6: Install and verify**

```bash
pnpm install
cd apps/web && pnpm build
```

Expected: build succeeds, all type imports resolve.

- [ ] **Step 7: Commit**

```bash
git add packages/types/ apps/web/lib/types.ts apps/web/package.json
git commit -m "feat: extract shared types into @cantina/types package"
```

---

## Task 4: Extract `packages/supabase`

**Files:**
- Create: `packages/supabase/package.json`
- Create: `packages/supabase/tsconfig.json`
- Create: `packages/supabase/client.ts`
- Create: `packages/supabase/server.ts`
- Create: `packages/supabase/service.ts`
- Modify: `apps/web/lib/supabase/` → re-export from package

- [ ] **Step 1: Create `packages/supabase/package.json`**

```json
{
  "name": "@cantina/supabase",
  "version": "0.0.1",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0"
  }
}
```

- [ ] **Step 2: Create `packages/supabase/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

- [ ] **Step 3: Create `packages/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Create `packages/supabase/server.ts`**

```typescript
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

export function createServerClient(cookieStore: ReadonlyRequestCookies) {
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 5: Create `packages/supabase/service.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 6: Create `packages/supabase/index.ts`**

```typescript
export { createClient } from './client'
export { createServerClient } from './server'
export { createServiceClient } from './service'
```

- [ ] **Step 7: Update `apps/web/lib/supabase/` to re-export**

Replace `apps/web/lib/supabase/client.ts`:
```typescript
export { createClient } from '@cantina/supabase'
```

Replace `apps/web/lib/supabase/server.ts`:
```typescript
import { cookies } from 'next/headers'
import { createServerClient } from '@cantina/supabase'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(cookieStore)
}
```

Replace `apps/web/lib/supabase/service.ts`:
```typescript
export { createServiceClient } from '@cantina/supabase'
```

- [ ] **Step 8: Add `@cantina/supabase` to `apps/web/package.json`**

```json
"dependencies": {
  "@cantina/supabase": "workspace:*",
  ...
}
```

- [ ] **Step 9: Install and verify**

```bash
pnpm install
cd apps/web && pnpm build
```

Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add packages/supabase/ apps/web/lib/supabase/ apps/web/package.json
git commit -m "feat: extract shared Supabase clients into @cantina/supabase package"
```

---

## Task 5: Bootstrap Admin App

**Files:**
- Create: `apps/admin/` (full Next.js app)

- [ ] **Step 1: Scaffold admin app**

```bash
cd apps
npx create-next-app@latest admin --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --yes
```

- [ ] **Step 2: Update `apps/admin/package.json`**

Change name and add workspace dependencies:

```json
{
  "name": "@cantina/admin",
  "dependencies": {
    "@cantina/types": "workspace:*",
    "@cantina/supabase": "workspace:*"
  }
}
```

- [ ] **Step 3: Initialize shadcn in admin app**

```bash
cd apps/admin
npx shadcn@latest init --defaults
npx shadcn@latest add button card input label badge table avatar dropdown-menu
```

- [ ] **Step 4: Create `.env.local` for admin app**

```
NEXT_PUBLIC_SUPABASE_URL=same-as-web
NEXT_PUBLIC_SUPABASE_ANON_KEY=same-as-web
SUPABASE_SERVICE_ROLE_KEY=same-as-web
ADMIN_EMAILS=felix@colaci.eu
```

- [ ] **Step 5: Create admin auth files**

Create `apps/admin/lib/supabase/server.ts`:

```typescript
import { cookies } from 'next/headers'
import { createServerClient } from '@cantina/supabase'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(cookieStore)
}
```

Create `apps/admin/lib/supabase/service.ts`:

```typescript
export { createServiceClient } from '@cantina/supabase'
```

Create `apps/admin/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  const isAdmin = user && adminEmails.includes(user.email ?? '')

  if (!isAdmin && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Create login pages**

Create `apps/admin/app/(auth)/login/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Cantina Colaci — Admin</h1>
        <LoginForm />
      </div>
    </div>
  )
}
```

Create `apps/admin/app/(auth)/login/login-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@cantina/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSent(true)
  }

  if (sent) return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
      </CardHeader>
    </Card>
  )

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">Send login link</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

Create `apps/admin/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/', request.url))
}
```

- [ ] **Step 7: Create admin server action**

Create `apps/admin/lib/actions/admin.ts`:

```typescript
'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { FlagName, Plan } from '@cantina/types'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!user || !adminEmails.includes(user.email ?? '')) throw new Error('Unauthorized')
}

export async function setFlagOverride(formData: FormData) {
  await assertAdmin()
  const db = createServiceClient()
  await db.from('feature_flag_overrides').upsert(
    {
      family_id: formData.get('family_id') as string,
      flag: formData.get('flag') as FlagName,
      enabled: formData.get('enabled') === 'true',
    },
    { onConflict: 'family_id,flag' }
  )
  redirect(`/families/${formData.get('family_id')}`)
}

export async function removeFlagOverride(formData: FormData) {
  await assertAdmin()
  const db = createServiceClient()
  await db.from('feature_flag_overrides')
    .delete()
    .eq('family_id', formData.get('family_id') as string)
    .eq('flag', formData.get('flag') as string)
  redirect(`/families/${formData.get('family_id')}`)
}

export async function changePlan(formData: FormData) {
  await assertAdmin()
  const db = createServiceClient()
  await db.from('families')
    .update({ plan: formData.get('plan') as Plan })
    .eq('id', formData.get('family_id') as string)
  redirect(`/families/${formData.get('family_id')}`)
}

export async function revokeApiKey(formData: FormData) {
  await assertAdmin()
  const db = createServiceClient()
  await db.from('api_keys').delete().eq('id', formData.get('id') as string)
  redirect(`/families/${formData.get('family_id')}`)
}
```

- [ ] **Step 8: Create dashboard page `apps/admin/app/page.tsx`**

```tsx
import { createServiceClient } from '@/lib/supabase/service'

export default async function AdminDashboard() {
  const db = createServiceClient()

  const [{ count: familyCount }, { count: userCount }, { data: planBreakdown }] =
    await Promise.all([
      db.from('families').select('*', { count: 'exact', head: true }),
      db.from('family_members').select('*', { count: 'exact', head: true }),
      db.from('families').select('plan'),
    ])

  const plans = (planBreakdown ?? []).reduce<Record<string, number>>((acc, f) => {
    acc[f.plan] = (acc[f.plan] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Families', value: familyCount ?? 0 },
          { label: 'Users', value: userCount ?? 0 },
          { label: 'Pro+', value: (plans.pro ?? 0) + (plans.business ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Create families list `apps/admin/app/families/page.tsx`**

```tsx
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export default async function FamiliesPage() {
  const db = createServiceClient()
  const { data: families } = await db
    .from('families')
    .select('id, name, plan, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Families</h1>
      <div className="border rounded-lg divide-y">
        {families?.map(f => (
          <Link key={f.id} href={`/families/${f.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
          >
            <div>
              <p className="font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(f.created_at).toLocaleDateString('de-DE')}
              </p>
            </div>
            <Badge variant={f.plan === 'free' ? 'secondary' : 'default'}>{f.plan}</Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Create family detail `apps/admin/app/families/[id]/page.tsx`**

```tsx
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setFlagOverride, removeFlagOverride, changePlan, revokeApiKey } from '@/lib/actions/admin'
import type { FlagName } from '@cantina/types'

const FLAG_NAMES: FlagName[] = [
  'mcp_integration', 'unlimited_cellar', 'advanced_stats',
  'shared_tours', 'winery_profiles', 'social_map',
]

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const [familyResult, membersResult, overridesResult, keysResult] = await Promise.all([
    db.from('families').select('id, name, plan').eq('id', id).maybeSingle(),
    db.from('family_members').select('user_id, role, joined_at').eq('family_id', id),
    db.from('feature_flag_overrides').select('flag, enabled').eq('family_id', id),
    db.from('api_keys').select('id, name, created_at').eq('family_id', id),
  ])

  if (!familyResult.data) notFound()
  const family = familyResult.data

  const overrides: Record<string, boolean> = {}
  for (const o of overridesResult.data ?? []) overrides[o.flag] = o.enabled

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{family.name}</h1>
        <Badge>{family.plan}</Badge>
      </div>

      {/* Change plan */}
      <section>
        <h2 className="font-semibold mb-3">Plan</h2>
        <div className="flex gap-2">
          {(['free', 'pro', 'business'] as const).map(plan => (
            <form key={plan} action={changePlan}>
              <input type="hidden" name="family_id" value={id} />
              <input type="hidden" name="plan" value={plan} />
              <Button type="submit" size="sm" variant={family.plan === plan ? 'default' : 'outline'}>
                {plan}
              </Button>
            </form>
          ))}
        </div>
      </section>

      {/* Feature flags */}
      <section>
        <h2 className="font-semibold mb-3">Feature Flags</h2>
        <div className="border rounded-lg divide-y">
          {FLAG_NAMES.map(flag => {
            const override = overrides[flag] ?? null
            return (
              <div key={flag} className="px-4 py-3 flex items-center justify-between">
                <code className="text-sm">{flag}</code>
                <div className="flex items-center gap-2">
                  {override !== null && (
                    <Badge variant={override ? 'default' : 'secondary'}>
                      {override ? 'on' : 'off'}
                    </Badge>
                  )}
                  <form action={setFlagOverride}>
                    <input type="hidden" name="family_id" value={id} />
                    <input type="hidden" name="flag" value={flag} />
                    <input type="hidden" name="enabled" value="true" />
                    <Button type="submit" size="sm" variant={override === true ? 'default' : 'outline'}>On</Button>
                  </form>
                  <form action={setFlagOverride}>
                    <input type="hidden" name="family_id" value={id} />
                    <input type="hidden" name="flag" value={flag} />
                    <input type="hidden" name="enabled" value="false" />
                    <Button type="submit" size="sm" variant={override === false ? 'destructive' : 'outline'}>Off</Button>
                  </form>
                  {override !== null && (
                    <form action={removeFlagOverride}>
                      <input type="hidden" name="family_id" value={id} />
                      <input type="hidden" name="flag" value={flag} />
                      <Button type="submit" size="sm" variant="ghost">Reset</Button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Members */}
      <section>
        <h2 className="font-semibold mb-3">Members ({membersResult.data?.length ?? 0})</h2>
        <div className="border rounded-lg divide-y">
          {membersResult.data?.map(m => (
            <div key={m.user_id} className="px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-mono text-muted-foreground">{m.user_id.slice(0, 16)}…</span>
              <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{m.role}</Badge>
            </div>
          ))}
        </div>
      </section>

      {/* API Keys */}
      {keysResult.data && keysResult.data.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">API Keys</h2>
          <div className="border rounded-lg divide-y">
            {keysResult.data.map(key => (
              <div key={key.id} className="px-4 py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <form action={revokeApiKey}>
                  <input type="hidden" name="id" value={key.id} />
                  <input type="hidden" name="family_id" value={id} />
                  <Button type="submit" size="sm" variant="destructive">Revoke</Button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 11: Create root layout `apps/admin/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = { title: 'Cantina Colaci Admin' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <aside className="w-48 border-r bg-muted/40 p-4 space-y-2">
            <p className="font-semibold text-sm mb-4">🍷 Admin</p>
            {[
              { href: '/', label: 'Dashboard' },
              { href: '/families', label: 'Families' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="block px-3 py-1.5 rounded text-sm hover:bg-muted transition-colors"
              >
                {label}
              </Link>
            ))}
          </aside>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 12: Install and run**

```bash
pnpm install
cd apps/admin && pnpm dev
```

Open `http://localhost:3001` (or whichever port Next.js picks). Log in with `felix@colaci.eu`, verify dashboard and families pages load.

- [ ] **Step 13: Commit**

```bash
git add apps/admin/
git commit -m "feat: add admin backoffice app with family, flag, and plan management"
```

---

## Task 6: Deploy Admin App to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create second Vercel project**

1. vercel.com → New Project → Import `felixcolaci/cantina-colaci`
2. **Root Directory:** set to `apps/admin`
3. Framework: Next.js (auto-detected)
4. Environment variables: same Supabase vars + `ADMIN_EMAILS=felix@colaci.eu`
5. Project name: `cantina-colaci-admin`

- [ ] **Step 3: Update Supabase auth redirect URLs**

In Supabase → Authentication → URL Configuration, add:
- `https://cantina-colaci-admin.vercel.app/auth/callback`

- [ ] **Step 4: Smoke test**

Open admin URL → log in → dashboard shows family/user counts → change a family plan → flag override toggles work → changes visible in Supabase Studio.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: admin deployment fixes"
git push origin main
```
