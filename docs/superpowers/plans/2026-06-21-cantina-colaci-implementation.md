# La Cantina Colaci — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Progressive Web App for cataloging and managing a family wine collection, with multi-account support, photo storage, tasting history, trip tracking, and read-only offline access.

**Architecture:** Next.js 15 App Router with React Server Components for data fetching and Server Actions for mutations. Supabase provides Postgres, Auth, and Storage. A serwist service worker caches the cellar and history pages for read-only offline use. Multi-tenancy is enforced via Supabase Row Level Security scoped to family membership.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (@supabase/ssr), shadcn/ui, Tailwind CSS, serwist (PWA), browser-image-compression, Vitest + React Testing Library

---

## File Map

```
cantina-colaci/
├── app/
│   ├── layout.tsx                          # Root layout: top bar + bottom nav
│   ├── page.tsx                            # Dashboard
│   ├── (auth)/login/
│   │   ├── page.tsx                        # Login page (server)
│   │   └── login-form.tsx                  # Magic link form (client)
│   ├── auth/callback/route.ts             # Supabase auth code exchange
│   ├── onboarding/
│   │   ├── page.tsx                        # Create family + cellar (server)
│   │   └── onboarding-form.tsx             # Onboarding form (client)
│   ├── cellar/page.tsx                     # Wine inventory list
│   ├── wine/
│   │   ├── new/
│   │   │   ├── page.tsx                    # Add wine page (server)
│   │   │   └── wine-form.tsx               # Add wine form (client)
│   │   └── [id]/
│   │       ├── page.tsx                    # Wine detail (server)
│   │       └── open-bottle-button.tsx      # Open bottle sheet (client)
│   ├── trips/
│   │   ├── page.tsx                        # Trips list (server)
│   │   └── new-trip-form.tsx               # New trip sheet (client)
│   ├── history/page.tsx                    # Consumed wines (server)
│   ├── family/
│   │   ├── page.tsx                        # Family members (server)
│   │   └── copy-invite-link.tsx            # Copy invite URL (client)
│   └── join/page.tsx                       # Accept invite link (server)
├── components/
│   ├── nav/
│   │   ├── bottom-nav.tsx                  # Mobile bottom navigation (client)
│   │   ├── top-bar.tsx                     # Top bar with avatar menu (server)
│   │   └── logout-button.tsx               # Sign out (client)
│   ├── dashboard/
│   │   └── stats-card.tsx                  # Stat tile
│   └── cellar/
│       └── wine-card.tsx                   # Wine list item
├── lib/
│   ├── types.ts                            # TypeScript interfaces for all DB entities
│   ├── image-compress.ts                   # Client-side image compression wrapper
│   ├── supabase/
│   │   ├── client.ts                       # Browser Supabase client
│   │   └── server.ts                       # Server Supabase client (cookie-based)
│   ├── actions/
│   │   ├── family.ts                       # createFamilyAndCellar server action
│   │   ├── wine.ts                         # addWine server action
│   │   ├── tasting.ts                      # openBottle server action
│   │   └── trips.ts                        # createTrip server action
│   └── __tests__/
│       ├── types.test.ts
│       └── image-compress.test.ts
├── supabase/migrations/
│   ├── 001_initial_schema.sql
│   └── 002_rls_policies.sql
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── middleware.ts                           # Auth redirect middleware
├── sw.ts                                   # Service worker (serwist)
├── next.config.ts
└── vitest.config.ts
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.env.local.example`

- [ ] **Step 1: Initialize Next.js 15**

```bash
cd /Users/fcolaci/source/github/felixcolaci/cantina-colaci
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --yes
```

- [ ] **Step 2: Install Supabase and utility packages**

```bash
npm install @supabase/supabase-js @supabase/ssr browser-image-compression
```

- [ ] **Step 3: Install dev/test packages**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

- [ ] **Step 5: Add shadcn components**

```bash
npx shadcn@latest add button card input label select textarea badge avatar dropdown-menu dialog sheet form tabs
```

- [ ] **Step 6: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Copy to `.env.local` and fill in values from Supabase dashboard → Settings → API.

- [ ] **Step 7: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 8: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 9: Add test scripts to `package.json`**

In the `"scripts"` section add:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 project with Supabase, shadcn, and Vitest"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p /Users/fcolaci/source/github/felixcolaci/cantina-colaci/supabase/migrations
```

- [ ] **Step 2: Write `001_initial_schema.sql`**

```sql
-- Families: top-level group (e.g. "Colaci", "Colaci Senior")
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Family members: many users per family
create table family_members (
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Cellars: belong to a family
create table cellars (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Trips: shopping trips (must be before cellar_entries for FK)
create table trips (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  name text not null,
  location text,
  date_start date,
  date_end date,
  created_at timestamptz not null default now()
);

-- Wines: the wine itself, independent of physical bottles
create table wines (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  name text not null,
  producer text not null,
  vintage int,
  region text,
  country text,
  grape_variety text,
  type text not null check (type in ('red', 'white', 'rosé', 'sparkling')),
  notes text,
  created_at timestamptz not null default now()
);

-- Cellar entries: physical bottles (one entry = one batch of bottles)
create table cellar_entries (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid not null references wines(id) on delete cascade,
  quantity int not null default 1 check (quantity >= 0),
  purchase_price numeric(10,2),
  purchase_date date,
  purchase_location text,
  shelf_location text,
  photo_url text,
  trip_id uuid references trips(id) on delete set null,
  status text not null default 'in_stock' check (status in ('in_stock', 'consumed', 'gifted')),
  created_at timestamptz not null default now()
);

-- Tastings: recorded when a bottle is opened
create table tastings (
  id uuid primary key default gen_random_uuid(),
  cellar_entry_id uuid not null references cellar_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  date date not null default current_date,
  rating int not null check (rating >= 1 and rating <= 10),
  notes text,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 3: Apply migration**

In Supabase dashboard → SQL Editor: paste and run the migration.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add initial database schema"
```

---

## Task 3: Row Level Security

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Write `002_rls_policies.sql`**

```sql
-- Helper: check if the current user is a member of a given family
create or replace function is_family_member(fid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from family_members
    where family_members.family_id = fid
    and family_members.user_id = auth.uid()
  );
$$;

-- Enable RLS on all tables
alter table families enable row level security;
alter table family_members enable row level security;
alter table cellars enable row level security;
alter table wines enable row level security;
alter table cellar_entries enable row level security;
alter table tastings enable row level security;
alter table trips enable row level security;

-- Families
create policy "members can read their family" on families
  for select using (is_family_member(id));
create policy "creator can update family" on families
  for update using (created_by = auth.uid());
create policy "authenticated users can create families" on families
  for insert with check (created_by = auth.uid());

-- Family members
create policy "members can read family membership" on family_members
  for select using (is_family_member(family_id));
create policy "owner can manage members" on family_members
  for all using (
    exists (
      select 1 from families
      where families.id = family_members.family_id
      and families.created_by = auth.uid()
    )
  );
create policy "users can join via invite" on family_members
  for insert with check (user_id = auth.uid());

-- Cellars
create policy "family members can read and manage cellars" on cellars
  for all using (is_family_member(family_id));

-- Wines
create policy "family members can read and manage wines" on wines
  for all using (
    exists (
      select 1 from cellars
      where cellars.id = wines.cellar_id
      and is_family_member(cellars.family_id)
    )
  );

-- Cellar entries
create policy "family members can read and manage entries" on cellar_entries
  for all using (
    exists (
      select 1 from wines
      join cellars on cellars.id = wines.cellar_id
      where wines.id = cellar_entries.wine_id
      and is_family_member(cellars.family_id)
    )
  );

-- Tastings
create policy "family members can read and manage tastings" on tastings
  for all using (
    exists (
      select 1 from cellar_entries
      join wines on wines.id = cellar_entries.wine_id
      join cellars on cellars.id = wines.cellar_id
      where cellar_entries.id = tastings.cellar_entry_id
      and is_family_member(cellars.family_id)
    )
  );

-- Trips
create policy "family members can read and manage trips" on trips
  for all using (
    exists (
      select 1 from cellars
      where cellars.id = trips.cellar_id
      and is_family_member(cellars.family_id)
    )
  );
```

- [ ] **Step 2: Apply RLS policies**

In Supabase dashboard → SQL Editor: paste and run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_rls_policies.sql
git commit -m "feat: add Row Level Security policies"
```

---

## Task 4: TypeScript Types & Supabase Clients

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `lib/__tests__/types.test.ts`

- [ ] **Step 1: Write `lib/types.ts`**

```typescript
export type WineType = 'red' | 'white' | 'rosé' | 'sparkling'
export type EntryStatus = 'in_stock' | 'consumed' | 'gifted'
export type FamilyRole = 'owner' | 'member'

export interface Family {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface FamilyMember {
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
}

export interface Cellar {
  id: string
  family_id: string
  name: string
  created_at: string
}

export interface Wine {
  id: string
  cellar_id: string
  name: string
  producer: string
  vintage: number | null
  region: string | null
  country: string | null
  grape_variety: string | null
  type: WineType
  notes: string | null
  created_at: string
}

export interface CellarEntry {
  id: string
  wine_id: string
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  photo_url: string | null
  trip_id: string | null
  status: EntryStatus
  created_at: string
}

export interface Tasting {
  id: string
  cellar_entry_id: string
  user_id: string
  date: string
  rating: number
  notes: string | null
  created_at: string
}

export interface Trip {
  id: string
  cellar_id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
  created_at: string
}
```

- [ ] **Step 2: Write `lib/__tests__/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import type { WineType, EntryStatus, FamilyRole } from '../types'

describe('domain type literals', () => {
  it('WineType covers all four values', () => {
    const types: WineType[] = ['red', 'white', 'rosé', 'sparkling']
    expect(types).toHaveLength(4)
  })

  it('EntryStatus covers all three values', () => {
    const statuses: EntryStatus[] = ['in_stock', 'consumed', 'gifted']
    expect(statuses).toHaveLength(3)
  })

  it('FamilyRole covers both values', () => {
    const roles: FamilyRole[] = ['owner', 'member']
    expect(roles).toHaveLength(2)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- lib/__tests__/types.test.ts
```

Expected output: `3 tests passed`

- [ ] **Step 4: Write `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Write `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
          } catch {
            // Ignore: called from Server Component
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Write `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/auth/callback', '/join']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/ middleware.ts
git commit -m "feat: add TypeScript types, Supabase clients, and auth middleware"
```

---

## Task 5: Auth — Login Page

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/login-form.tsx`
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create `app/(auth)/login/page.tsx`**

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
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🍷</p>
          <h1 className="text-3xl font-bold">La Cantina Colaci</h1>
          <p className="text-muted-foreground mt-2">La vostra collezione di vini</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(auth)/login/login-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Controlla la tua email</CardTitle>
          <CardDescription>Abbiamo inviato un link di accesso a {email}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accedi</CardTitle>
        <CardDescription>Inserisci la tua email per ricevere un link di accesso</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="felix@colaci.eu"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Invio in corso…' : 'Invia link di accesso'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create `app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
```

- [ ] **Step 4: Configure Supabase auth settings**

In Supabase dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs: add `http://localhost:3000/auth/callback`

- [ ] **Step 5: Smoke test login**

```bash
npm run dev
```

Open `http://localhost:3000` → redirected to `/login`. Enter `felix@colaci.eu` → "Controlla la tua email" message appears. Click the email link → redirected to `/`.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: add magic link authentication"
```

---

## Task 6: Onboarding — Create Family & Cellar

After first login, users have no family. This flow creates one.

**Files:**
- Create: `lib/actions/family.ts`
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/onboarding-form.tsx`

- [ ] **Step 1: Create `lib/actions/family.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createFamilyAndCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const familyName = formData.get('familyName') as string
  const cellarName = formData.get('cellarName') as string

  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ name: familyName, created_by: user.id })
    .select()
    .single()

  if (familyError) throw new Error(familyError.message)

  await supabase
    .from('family_members')
    .insert({ family_id: family.id, user_id: user.id, role: 'owner' })

  await supabase
    .from('cellars')
    .insert({ family_id: family.id, name: cellarName })

  redirect('/')
}
```

- [ ] **Step 2: Create `app/onboarding/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Benvenuto in Cantina Colaci 🍷</h1>
        <OnboardingForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/onboarding/onboarding-form.tsx`**

```tsx
'use client'

import { createFamilyAndCellar } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea la tua cantina</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createFamilyAndCellar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyName">Nome della famiglia</Label>
            <Input id="familyName" name="familyName" placeholder="Colaci" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellarName">Nome della cantina</Label>
            <Input id="cellarName" name="cellarName" placeholder="Cantina principale" required />
          </div>
          <Button type="submit" className="w-full">Crea cantina</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/ lib/actions/family.ts
git commit -m "feat: add family and cellar onboarding flow"
```

---

## Task 7: Root Layout & Navigation

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/nav/bottom-nav.tsx`
- Create: `components/nav/top-bar.tsx`
- Create: `components/nav/logout-button.tsx`

- [ ] **Step 1: Create `components/nav/bottom-nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wine, Map, History } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/cellar', label: 'Cantina', icon: Wine },
  { href: '/trips', label: 'Viaggi', icon: Map },
  { href: '/history', label: 'Storia', icon: History },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors',
              pathname === href ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create `components/nav/logout-button.tsx`**

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return <DropdownMenuItem onClick={handleLogout}>Esci</DropdownMenuItem>
}
```

- [ ] **Step 3: Create `components/nav/top-bar.tsx`**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogoutButton } from './logout-button'

export async function TopBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b h-14 flex items-center px-4 justify-between">
      <h1 className="font-semibold text-lg">🍷 Cantina Colaci</h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/family">Famiglia</Link>
          </DropdownMenuItem>
          <LogoutButton />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 4: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'La Cantina Colaci',
  description: 'La vostra collezione di vini',
  manifest: '/manifest.json',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="it">
      <body className={inter.className}>
        {user && <TopBar />}
        <main className={user ? 'pt-14 pb-16 min-h-screen' : 'min-h-screen'}>
          {children}
        </main>
        {user && <BottomNav />}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Test navigation**

```bash
npm run dev
```

After login: top bar with avatar and bottom nav with 4 items are visible. Clicking each nav item routes correctly. Avatar dropdown shows "Famiglia" and "Esci".

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/nav/
git commit -m "feat: add top bar and bottom navigation"
```

---

## Task 8: Dashboard

**Files:**
- Create: `components/dashboard/stats-card.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/dashboard/stats-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  value: string | number
}

export function StatsCard({ title, value }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Write `app/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/onboarding')

  const { data: wines } = await supabase
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  const { data: inStockEntries } = wineIds.length
    ? await supabase
        .from('cellar_entries')
        .select('quantity')
        .in('wine_id', wineIds)
        .eq('status', 'in_stock')
    : { data: [] }

  const totalBottles = (inStockEntries ?? []).reduce((sum, e) => sum + e.quantity, 0)

  const { data: recentTastings } = await supabase
    .from('tastings')
    .select('id, date, rating, cellar_entries(wines(name, producer))')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Benvenuto</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Bottiglie in cantina" value={totalBottles} />
        <StatsCard title="Vini diversi" value={wineIds.length} />
      </div>

      {recentTastings && recentTastings.length > 0 && (
        <section>
          <h3 className="font-medium mb-3">Ultime degustazioni</h3>
          <div className="space-y-2">
            {recentTastings.map(t => {
              const wine = (t.cellar_entries as any)?.wines
              return (
                <div key={t.id} className="flex justify-between items-center p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{wine?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span className="font-bold">{t.rating}/10</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {wineIds.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-4xl mb-2">🍾</p>
          <p>La cantina è vuota</p>
          <Link href="/wine/new" className="mt-3 inline-block text-primary underline">
            Aggiungi il primo vino
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx components/dashboard/
git commit -m "feat: add dashboard with stats and recent tastings"
```

---

## Task 9: Cellar Page

**Files:**
- Create: `app/cellar/page.tsx`
- Create: `components/cellar/wine-card.tsx`

- [ ] **Step 1: Create `components/cellar/wine-card.tsx`**

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Wine, CellarEntry } from '@/lib/types'

const typeLabel: Record<string, string> = {
  red: 'Rosso', white: 'Bianco', rosé: 'Rosé', sparkling: 'Spumante',
}

interface WineCardProps {
  wine: Wine
  entries: Pick<CellarEntry, 'quantity' | 'photo_url'>[]
}

export function WineCard({ wine, entries }: WineCardProps) {
  const totalBottles = entries.reduce((sum, e) => sum + e.quantity, 0)
  const photo = entries.find(e => e.photo_url)?.photo_url

  return (
    <Link href={`/wine/${wine.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-3 flex gap-3 items-center">
          {photo ? (
            <img src={photo} alt={wine.name} className="w-10 h-14 object-cover rounded shrink-0" />
          ) : (
            <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-xl shrink-0">🍷</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{wine.name}</p>
            <p className="text-sm text-muted-foreground truncate">{wine.producer}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {wine.vintage && <span className="text-xs text-muted-foreground">{wine.vintage}</span>}
              <Badge variant="outline" className="text-xs">{typeLabel[wine.type]}</Badge>
              {wine.region && <span className="text-xs text-muted-foreground">{wine.region}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold">{totalBottles}</p>
            <p className="text-xs text-muted-foreground">bott.</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Create `app/cellar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineCard } from '@/components/cellar/wine-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WineType } from '@/lib/types'

const wineTypes: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rosso' },
  { value: 'white', label: 'Bianco' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Spumante' },
]

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/onboarding')

  let query = supabase
    .from('wines')
    .select('*, cellar_entries!inner(quantity, photo_url, status)')
    .eq('cellar_id', cellar.id)
    .eq('cellar_entries.status', 'in_stock')
    .gt('cellar_entries.quantity', 0)
    .order('name')

  if (type) query = (query as any).eq('type', type)

  const { data: wines } = await query

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Cantina</h2>
        <Button asChild size="sm">
          <Link href="/wine/new"><Plus className="h-4 w-4 mr-1" />Aggiungi</Link>
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <Link
          href="/cellar"
          className={cn(
            'shrink-0 px-3 py-1 rounded-full text-sm border transition-colors',
            !type ? 'bg-primary text-primary-foreground' : 'bg-background'
          )}
        >
          Tutti
        </Link>
        {wineTypes.map(t => (
          <Link
            key={t.value}
            href={type === t.value ? '/cellar' : `/cellar?type=${t.value}`}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full text-sm border transition-colors',
              type === t.value ? 'bg-primary text-primary-foreground' : 'bg-background'
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {wines && wines.length > 0 ? (
        <div className="space-y-2">
          {wines.map(wine => (
            <WineCard key={wine.id} wine={wine} entries={wine.cellar_entries} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-2">🍾</p>
          <p>Nessun vino in cantina</p>
          <Button asChild className="mt-4">
            <Link href="/wine/new">Aggiungi il primo vino</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/cellar/ components/cellar/
git commit -m "feat: add cellar page with wine list and type filter"
```

---

## Task 10: Add Wine Form with Photo Upload

**Files:**
- Create: `lib/image-compress.ts`
- Create: `lib/__tests__/image-compress.test.ts`
- Create: `lib/actions/wine.ts`
- Create: `app/wine/new/page.tsx`
- Create: `app/wine/new/wine-form.tsx`

- [ ] **Step 1: Create `lib/image-compress.ts`**

```typescript
import imageCompression from 'browser-image-compression'

export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
  })
}
```

- [ ] **Step 2: Write `lib/__tests__/image-compress.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}))

import { compressImage } from '../image-compress'

describe('compressImage', () => {
  it('returns a File', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const result = await compressImage(file)
    expect(result).toBeInstanceOf(File)
  })
})
```

- [ ] **Step 3: Run test**

```bash
npm run test:run -- lib/__tests__/image-compress.test.ts
```

Expected: `1 test passed`

- [ ] **Step 4: Create `lib/actions/wine.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WineType } from '@/lib/types'

async function getCellarId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return cellar?.id ?? null
}

export async function addWine(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const cellarId = await getCellarId(supabase, user.id)
  if (!cellarId) redirect('/onboarding')

  const { data: wine, error: wineError } = await supabase
    .from('wines')
    .insert({
      cellar_id: cellarId,
      name: formData.get('name') as string,
      producer: formData.get('producer') as string,
      vintage: formData.get('vintage') ? parseInt(formData.get('vintage') as string) : null,
      region: (formData.get('region') as string) || null,
      country: (formData.get('country') as string) || null,
      grape_variety: (formData.get('grape_variety') as string) || null,
      type: formData.get('type') as WineType,
      notes: (formData.get('notes') as string) || null,
    })
    .select()
    .single()

  if (wineError) throw new Error(wineError.message)

  let photo_url: string | null = null
  const photoFile = formData.get('photo') as File | null
  if (photoFile && photoFile.size > 0) {
    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    const path = `families/${membership.family_id}/wines/${wine.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('wine-photos')
      .upload(path, photoFile, { contentType: photoFile.type })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('wine-photos').getPublicUrl(path)
      photo_url = urlData.publicUrl
    }
  }

  await supabase.from('cellar_entries').insert({
    wine_id: wine.id,
    quantity: parseInt((formData.get('quantity') as string) ?? '1'),
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
    shelf_location: (formData.get('shelf_location') as string) || null,
    trip_id: (formData.get('trip_id') as string) || null,
    photo_url,
    status: 'in_stock',
  })

  redirect(`/wine/${wine.id}`)
}
```

- [ ] **Step 5: Create `app/wine/new/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineForm } from './wine-form'

export default async function NewWinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: trips } = cellar
    ? await supabase
        .from('trips')
        .select('id, name')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-6">Aggiungi vino</h2>
      <WineForm trips={trips ?? []} />
    </div>
  )
}
```

- [ ] **Step 6: Create `app/wine/new/wine-form.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import { addWine } from '@/lib/actions/wine'
import { compressImage } from '@/lib/image-compress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Trip } from '@/lib/types'

interface WineFormProps {
  trips: Pick<Trip, 'id' | 'name'>[]
}

export function WineForm({ trips }: WineFormProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setCompressedFile(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(formData: FormData) {
    if (compressedFile) formData.set('photo', compressedFile)
    await addWine(formData)
  }

  return (
    <form action={handleSubmit} className="space-y-4 pb-8">
      {/* Photo */}
      <div className="space-y-2">
        <Label>Foto della bottiglia</Label>
        {preview && (
          <img src={preview} alt="Anteprima" className="w-24 h-32 object-cover rounded border" />
        )}
        <Input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="producer">Produttore *</Label>
        <Input id="producer" name="producer" required />
      </div>

      <div className="space-y-2">
        <Label>Tipo *</Label>
        <Select name="type" required>
          <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="red">Rosso</SelectItem>
            <SelectItem value="white">Bianco</SelectItem>
            <SelectItem value="rosé">Rosé</SelectItem>
            <SelectItem value="sparkling">Spumante</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="vintage">Annata</Label>
          <Input id="vintage" name="vintage" type="number" min="1900" max="2099" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Bottiglie</Label>
          <Input id="quantity" name="quantity" type="number" min="1" defaultValue="1" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="region">Regione</Label>
        <Input id="region" name="region" placeholder="es. Toscana" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Paese</Label>
        <Input id="country" name="country" placeholder="es. Italia" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grape_variety">Vitigno</Label>
        <Input id="grape_variety" name="grape_variety" placeholder="es. Sangiovese" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Prezzo (€)</Label>
          <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Data acquisto</Label>
          <Input id="purchase_date" name="purchase_date" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="purchase_location">Luogo acquisto</Label>
        <Input id="purchase_location" name="purchase_location" placeholder="es. Montalcino" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shelf_location">Posizione in cantina</Label>
        <Input id="shelf_location" name="shelf_location" placeholder="es. Scaffale B / Fila 3" />
      </div>

      {trips.length > 0 && (
        <div className="space-y-2">
          <Label>Viaggio</Label>
          <Select name="trip_id">
            <SelectTrigger><SelectValue placeholder="Seleziona viaggio (opzionale)" /></SelectTrigger>
            <SelectContent>
              {trips.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" placeholder="Note generali sul vino…" />
      </div>

      <Button type="submit" className="w-full">Aggiungi vino</Button>
    </form>
  )
}
```

- [ ] **Step 7: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `wine-photos`
- Public: ✓ (so photo URLs are accessible without auth token)

In Supabase → SQL Editor, add storage RLS:

```sql
create policy "authenticated users can upload wine photos"
on storage.objects for insert
with check (bucket_id = 'wine-photos' and auth.uid() is not null);

create policy "wine photos are publicly readable"
on storage.objects for select
using (bucket_id = 'wine-photos');
```

- [ ] **Step 8: Commit**

```bash
git add app/wine/new/ lib/actions/wine.ts lib/image-compress.ts lib/__tests__/image-compress.test.ts
git commit -m "feat: add wine creation form with photo upload and image compression"
```

---

## Task 11: Wine Detail & Open Bottle

**Files:**
- Create: `lib/actions/tasting.ts`
- Create: `app/wine/[id]/page.tsx`
- Create: `app/wine/[id]/open-bottle-button.tsx`

- [ ] **Step 1: Create `lib/actions/tasting.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function openBottle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarEntryId = formData.get('cellar_entry_id') as string

  await supabase.from('tastings').insert({
    cellar_entry_id: cellarEntryId,
    user_id: user.id,
    date: formData.get('date') as string,
    rating: parseInt(formData.get('rating') as string),
    notes: (formData.get('notes') as string) || null,
  })

  const { data: entry } = await supabase
    .from('cellar_entries')
    .select('quantity, wine_id')
    .eq('id', cellarEntryId)
    .single()

  if (!entry) throw new Error('Entry not found')

  const newQuantity = entry.quantity - 1
  await supabase
    .from('cellar_entries')
    .update({ quantity: newQuantity, status: newQuantity <= 0 ? 'consumed' : 'in_stock' })
    .eq('id', cellarEntryId)

  redirect(`/wine/${entry.wine_id}`)
}
```

- [ ] **Step 2: Create `app/wine/[id]/open-bottle-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { openBottle } from '@/lib/actions/tasting'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">🍾 Apri una bottiglia</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Degustazione</SheetTitle>
        </SheetHeader>
        <form action={openBottle} className="space-y-4 mt-4">
          <input type="hidden" name="cellar_entry_id" value={entryId} />
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" name="date" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Voto (1–10)</Label>
            <Input id="rating" name="rating" type="number" min="1" max="10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Note di degustazione</Label>
            <Textarea id="notes" name="notes" placeholder="Profumo, sapore, abbinamento…" />
          </div>
          <Button type="submit" className="w-full">Salva degustazione</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Create `app/wine/[id]/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { OpenBottleButton } from './open-bottle-button'

export default async function WineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wine } = await supabase
    .from('wines')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!wine) notFound()

  const { data: entries } = await supabase
    .from('cellar_entries')
    .select('*')
    .eq('wine_id', id)
    .order('created_at', { ascending: false })

  const entryIds = (entries ?? []).map(e => e.id)

  const { data: tastings } = entryIds.length
    ? await supabase
        .from('tastings')
        .select('*')
        .in('cellar_entry_id', entryIds)
        .order('date', { ascending: false })
    : { data: [] }

  const inStockEntries = (entries ?? []).filter(e => e.status === 'in_stock')
  const totalBottles = inStockEntries.reduce((sum, e) => sum + e.quantity, 0)
  const photo = (entries ?? []).find(e => e.photo_url)?.photo_url

  const typeLabel: Record<string, string> = {
    red: 'Rosso', white: 'Bianco', rosé: 'Rosé', sparkling: 'Spumante',
  }

  return (
    <div className="max-w-lg mx-auto">
      {photo && (
        <img src={photo} alt={wine.name} className="w-full h-56 object-cover" />
      )}
      <div className="px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{wine.name}</h2>
          <p className="text-muted-foreground">{wine.producer}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {wine.vintage && <Badge variant="outline">{wine.vintage}</Badge>}
            <Badge>{typeLabel[wine.type]}</Badge>
            {wine.region && <Badge variant="secondary">{wine.region}</Badge>}
            {wine.grape_variety && <Badge variant="secondary">{wine.grape_variety}</Badge>}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted text-center">
          <p className="text-4xl font-bold">{totalBottles}</p>
          <p className="text-sm text-muted-foreground">bottiglie in cantina</p>
        </div>

        {inStockEntries.length > 0 && <OpenBottleButton entryId={inStockEntries[0].id} />}

        {wine.notes && (
          <div>
            <h3 className="font-semibold mb-1">Note</h3>
            <p className="text-sm text-muted-foreground">{wine.notes}</p>
          </div>
        )}

        {tastings && tastings.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Degustazioni ({tastings.length})</h3>
            <div className="space-y-2">
              {tastings.map(t => (
                <div key={t.id} className="p-3 rounded-lg border">
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-muted-foreground">{t.date}</p>
                    <span className="font-bold text-lg">{t.rating}/10</span>
                  </div>
                  {t.notes && <p className="text-sm mt-1">{t.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/wine/[id]/ lib/actions/tasting.ts
git commit -m "feat: add wine detail page with open-bottle and tasting flow"
```

---

## Task 12: Trips Page

**Files:**
- Create: `lib/actions/trips.ts`
- Create: `app/trips/page.tsx`
- Create: `app/trips/new-trip-form.tsx`

- [ ] **Step 1: Create `lib/actions/trips.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createTrip(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!cellar) redirect('/onboarding')

  await supabase.from('trips').insert({
    cellar_id: cellar.id,
    name: formData.get('name') as string,
    location: (formData.get('location') as string) || null,
    date_start: (formData.get('date_start') as string) || null,
    date_end: (formData.get('date_end') as string) || null,
  })

  redirect('/trips')
}
```

- [ ] **Step 2: Create `app/trips/new-trip-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createTrip } from '@/lib/actions/trips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Plus } from 'lucide-react'

export function NewTripForm() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full"><Plus className="h-4 w-4 mr-2" />Nuovo viaggio</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader><SheetTitle>Nuovo viaggio</SheetTitle></SheetHeader>
        <form action={createTrip} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" placeholder="Toscana Estate 2026" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Luogo</Label>
            <Input id="location" name="location" placeholder="Toscana, Italia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date_start">Inizio</Label>
              <Input id="date_start" name="date_start" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_end">Fine</Label>
              <Input id="date_end" name="date_end" type="date" />
            </div>
          </div>
          <Button type="submit" className="w-full">Crea viaggio</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Create `app/trips/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NewTripForm } from './new-trip-form'

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: trips } = cellar
    ? await supabase
        .from('trips')
        .select('*')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Viaggi</h2>
      <NewTripForm />

      {trips && trips.length > 0 ? (
        <div className="space-y-3">
          {trips.map(trip => (
            <Card key={trip.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{trip.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2 flex-wrap">
                {trip.location && <Badge variant="outline">{trip.location}</Badge>}
                {trip.date_start && (
                  <span className="text-sm text-muted-foreground">
                    {trip.date_start}{trip.date_end ? ` → ${trip.date_end}` : ''}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">Nessun viaggio ancora 🗺️</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/trips/ lib/actions/trips.ts
git commit -m "feat: add trips page with create trip flow"
```

---

## Task 13: History Page

**Files:**
- Create: `app/history/page.tsx`

- [ ] **Step 1: Create `app/history/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: wines } = cellar
    ? await supabase.from('wines').select('id').eq('cellar_id', cellar.id)
    : { data: [] }

  const wineIds = (wines ?? []).map(w => w.id)

  const { data: entries } = wineIds.length
    ? await supabase
        .from('cellar_entries')
        .select(`
          id, status, created_at,
          wine:wines(name, producer, vintage, type),
          tastings(id, date, rating, notes)
        `)
        .in('wine_id', wineIds)
        .in('status', ['consumed', 'gifted'])
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Storia</h2>

      {entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map(entry => {
            const wine = entry.wine as any
            const tastings = (entry.tastings ?? []) as any[]
            const avgRating = tastings.length
              ? (tastings.reduce((s: number, t: any) => s + t.rating, 0) / tastings.length).toFixed(1)
              : null

            return (
              <div key={entry.id} className="p-4 rounded-lg border space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{wine?.name}</p>
                    <p className="text-sm text-muted-foreground">{wine?.producer}</p>
                  </div>
                  {avgRating && <span className="text-xl font-bold">{avgRating}/10</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {wine?.vintage && <Badge variant="outline">{wine.vintage}</Badge>}
                  <Badge variant={entry.status === 'consumed' ? 'default' : 'secondary'}>
                    {entry.status === 'consumed' ? 'Bevuto' : 'Regalato'}
                  </Badge>
                </div>
                {tastings.map((t: any) =>
                  t.notes ? (
                    <p key={t.id} className="text-sm text-muted-foreground italic">"{t.notes}"</p>
                  ) : null
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          Nessun vino ancora bevuto — apri una bottiglia! 🍷
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/history/
git commit -m "feat: add history page with consumed and gifted wines"
```

---

## Task 14: Family Management & Invite Links

**Files:**
- Create: `app/family/page.tsx`
- Create: `app/family/copy-invite-link.tsx`
- Create: `app/join/page.tsx`

- [ ] **Step 1: Create `app/family/copy-invite-link.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyInviteLink({ familyId }: { familyId: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}/join?family=${familyId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" className="w-full" onClick={copy}>
      {copied ? '✓ Link copiato!' : 'Copia link di invito'}
    </Button>
  )
}
```

- [ ] **Step 2: Create `app/family/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyInviteLink } from './copy-invite-link'

export default async function FamilyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id, role, families(name)')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: members } = await supabase
    .from('family_members')
    .select('user_id, role, joined_at')
    .eq('family_id', membership.family_id)

  const family = membership.families as any

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Famiglia</h2>

      <Card>
        <CardHeader>
          <CardTitle>{family?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members?.map(m => (
            <div key={m.user_id} className="flex justify-between items-center py-1">
              <span className="text-sm font-mono text-muted-foreground">{m.user_id.slice(0, 12)}…</span>
              <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {membership.role === 'owner' && (
        <div>
          <h3 className="font-medium mb-2">Invita un membro</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Condividi il link. Dopo il login, il membro verrà aggiunto automaticamente alla tua famiglia.
          </p>
          <CopyInviteLink familyId={membership.family_id} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/join/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string }>
}) {
  const { family: familyId } = await searchParams
  if (!familyId) redirect('/')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join?family=${familyId}`)
  }

  const { data: existing } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    // Verify family exists before adding
    const { data: family } = await supabase
      .from('families')
      .select('id')
      .eq('id', familyId)
      .maybeSingle()

    if (family) {
      await supabase.from('family_members').insert({
        family_id: familyId,
        user_id: user.id,
        role: 'member',
      })
    }
  }

  redirect('/')
}
```

- [ ] **Step 4: Commit**

```bash
git add app/family/ app/join/
git commit -m "feat: add family management page and invite link flow"
```

---

## Task 15: PWA Configuration

**Files:**
- Create: `public/manifest.json`
- Create: `sw.ts`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx` (add PWA meta tags)
- Create: `public/icons/icon-192.png` and `icon-512.png`

- [ ] **Step 1: Install serwist**

```bash
npm install @serwist/next serwist
```

- [ ] **Step 2: Create `public/manifest.json`**

```json
{
  "name": "La Cantina Colaci",
  "short_name": "Cantina",
  "description": "La vostra collezione di vini",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#7c2d12",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Create PWA icons**

Create a simple wine-themed icon (any 512×512 PNG with a wine glass or bottle). Save as:
- `public/icons/icon-512.png`
- `public/icons/icon-192.png` (resized to 192×192)

For a quick placeholder, use any square PNG and rename it.

- [ ] **Step 4: Create `sw.ts`**

```typescript
import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

declare const self: ServiceWorkerGlobalScope & typeof globalThis & { __SW_MANIFEST: any }

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request }) =>
        request.destination === 'document' &&
        ['/', '/cellar', '/history'].includes(new URL(request.url).pathname),
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'pages-cache' },
    },
  ],
})

serwist.addEventListeners()
```

- [ ] **Step 5: Update `next.config.ts`**

```typescript
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {}

export default withSerwist(nextConfig)
```

- [ ] **Step 6: Update metadata in `app/layout.tsx`**

Replace the `metadata` export with:

```typescript
export const metadata: Metadata = {
  title: 'La Cantina Colaci',
  description: 'La vostra collezione di vini',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cantina',
  },
}
```

- [ ] **Step 7: Build and verify service worker**

```bash
npm run build && npm run start
```

Open `http://localhost:3000` in Chrome → DevTools → Application → Service Workers. Verify "cantina-colaci" service worker is registered and active.

Navigate to `/cellar`, then in DevTools → Network → set "Offline". Reload `/cellar` — page loads from cache.

- [ ] **Step 8: Commit**

```bash
git add public/ sw.ts next.config.ts app/layout.tsx
git commit -m "feat: add PWA manifest and serwist service worker for offline support"
```

---

## Task 16: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create Vercel project**

1. Go to vercel.com → New Project → Import `felixcolaci/cantina-colaci`
2. Framework preset: Next.js (auto-detected)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` → Supabase dashboard → Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase dashboard → Settings → API → anon key
4. Deploy

- [ ] **Step 3: Update Supabase auth settings for production**

In Supabase → Authentication → URL Configuration:
- Site URL: `https://<your-project>.vercel.app`
- Redirect URLs: add `https://<your-project>.vercel.app/auth/callback`

- [ ] **Step 4: Smoke test in production**

1. Open production URL → redirected to `/login`
2. Log in with magic link
3. Create family + cellar (onboarding)
4. Add a wine with a photo
5. Open a bottle → add rating + notes → appears in `/history`
6. On mobile: browser menu → "Add to Home Screen" → install PWA
7. Turn off WiFi → open app → `/cellar` loads from cache

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: production deployment fixes"
git push origin main
```

---

## Run all tests

```bash
npm run test:run
```

Expected: `4 tests passed` (types ×3, image-compress ×1)
