# Invitation Code Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate new account creation behind single-use invitation codes stored in Supabase, with a `/register` page that validates a code, creates the user, and signs them in.

**Architecture:** A new `invitation_codes` DB table (service-role only RLS) is validated server-side in a `registerWithCode` Server Action. The register form calls the action, then signs in client-side via `signInWithPassword` — matching the existing login pattern. No admin UI; codes are created manually in the Supabase Dashboard.

**Tech Stack:** Next.js 15 App Router, Supabase Auth (`auth.admin.createUser`), Vitest, `useServerAction` hook, shadcn/ui

## Global Constraints

- `invitation_codes` table: no client-side access, service_role only
- Error messages exactly as specified: `'Ungültiger Einladungscode'`, `'Diese E-Mail-Adresse ist bereits registriert'`, `'Registrierung fehlgeschlagen'`
- Password minimum length: 8 characters (`minLength={8}` on input)
- `registerWithCode` never creates an orphaned user: user creation happens only after code validation succeeds
- Code is marked used (`used_at`, `used_by`) only after `createUser` succeeds
- `email_confirm: true` passed to `createUser` so no email verification step is required

---

### Task 1: DB Migration — `invitation_codes` table

**Files:**
- Create: `supabase/migrations/012_invitation_codes.sql`

**Interfaces:**
- Produces: `invitation_codes` table with columns `code text PK`, `created_at timestamptz`, `used_at timestamptz`, `used_by uuid`; RLS enabled; service_role has full access

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/012_invitation_codes.sql
CREATE TABLE invitation_codes (
  code       text        PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  used_by    uuid        REFERENCES auth.users(id)
);

ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated — all access is via service_role
GRANT SELECT, INSERT, UPDATE ON public.invitation_codes TO service_role;
```

- [ ] **Step 2: Apply migration via Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste the SQL above → Run.

Expected: query executes without error, `invitation_codes` table appears in Table Editor.

- [ ] **Step 3: Insert a test invitation code**

In Supabase Dashboard → Table Editor → `invitation_codes` → Insert row:
- `code`: `TEST-CODE-001`
- Leave `used_at` and `used_by` as NULL

Expected: row inserted successfully.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/012_invitation_codes.sql
git commit -m "feat: add invitation_codes migration"
```

---

### Task 2: Server Action `registerWithCode`

**Files:**
- Create: `lib/actions/auth.ts`
- Create: `lib/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/server` — returns a Supabase client with `.from(table)` and `.auth.admin.createUser(opts)`
- Produces: `registerWithCode(email: string, password: string, code: string): Promise<{ error: string | null }>`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock before importing the module under test
const mockFrom = vi.fn()
const mockAdminCreateUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: mockFrom,
    auth: { admin: { createUser: mockAdminCreateUser } },
  }),
}))

import { registerWithCode } from '../actions/auth'

function mockInviteQuery(found: boolean) {
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        is: () => ({
          maybeSingle: () => Promise.resolve({ data: found ? { code: 'VALID-CODE' } : null }),
        }),
      }),
    }),
  })
}

function mockUpdateQuery() {
  mockFrom.mockReturnValueOnce({
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  })
}

describe('registerWithCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when code is not found or already used', async () => {
    mockInviteQuery(false)
    const result = await registerWithCode('a@b.com', 'password123', 'BAD-CODE')
    expect(result).toEqual({ error: 'Ungültiger Einladungscode' })
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
  })

  it('returns error when email is already registered', async () => {
    mockInviteQuery(true)
    mockAdminCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'User already registered' },
    })
    const result = await registerWithCode('existing@b.com', 'password123', 'VALID-CODE')
    expect(result).toEqual({ error: 'Diese E-Mail-Adresse ist bereits registriert' })
  })

  it('returns generic error on unexpected createUser failure', async () => {
    mockInviteQuery(true)
    mockAdminCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'Internal server error' },
    })
    const result = await registerWithCode('new@b.com', 'password123', 'VALID-CODE')
    expect(result).toEqual({ error: 'Registrierung fehlgeschlagen' })
  })

  it('marks code as used and returns no error on success', async () => {
    mockInviteQuery(true)
    mockAdminCreateUser.mockResolvedValueOnce({
      data: { user: { id: 'user-abc-123' } },
      error: null,
    })
    mockUpdateQuery()
    const result = await registerWithCode('new@b.com', 'password123', 'VALID-CODE')
    expect(result).toEqual({ error: null })
    // Verify code was marked used (second call to .from)
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'invitation_codes')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
npm run test:run -- lib/__tests__/auth.test.ts
```

Expected: 4 tests FAIL with "Cannot find module '../actions/auth'"

- [ ] **Step 3: Implement `registerWithCode`**

Create `lib/actions/auth.ts`:

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function registerWithCode(
  email: string,
  password: string,
  code: string,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('invitation_codes')
    .select('code')
    .eq('code', code)
    .is('used_at', null)
    .maybeSingle()

  if (!invite) {
    return { error: 'Ungültiger Einladungscode' }
  }

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message.includes('already registered')) {
      return { error: 'Diese E-Mail-Adresse ist bereits registriert' }
    }
    return { error: 'Registrierung fehlgeschlagen' }
  }

  await admin
    .from('invitation_codes')
    .update({ used_at: new Date().toISOString(), used_by: userData.user.id })
    .eq('code', code)

  return { error: null }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm run test:run -- lib/__tests__/auth.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/actions/auth.ts lib/__tests__/auth.test.ts
git commit -m "feat: add registerWithCode server action"
```

---

### Task 3: Register page and form

**Files:**
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/register/register-form.tsx`

**Interfaces:**
- Consumes: `registerWithCode` from `@/lib/actions/auth`, `createClient` from `@/lib/supabase/client`, `useServerAction` from `@/lib/hooks/use-server-action`
- Produces: `/register` route — Server Component `RegisterPage` + Client Component `RegisterForm`

- [ ] **Step 1: Create the page Server Component**

Create `app/(auth)/register/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterForm } from './register-form'

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--primary)',
              lineHeight: 1.1,
              marginBottom: '0.25rem',
            }}
          >
            Vino Mio
          </h1>
          <p className="text-muted-foreground mt-2">Il tuo cellar di famiglia</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the register form Client Component**

Create `app/(auth)/register/register-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerWithCode } from '@/lib/actions/auth'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)

  const { run: handleRegister, isPending } = useServerAction(async () => {
    setRegisterError(null)
    const result = await registerWithCode(email, password, code)
    if (result.error) {
      setRegisterError(result.error)
      return
    }
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      router.push('/login')
      return
    }
    router.push('/')
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrieren</CardTitle>
        <CardDescription>Einladungscode eingeben und Account erstellen</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={e => { e.preventDefault(); handleRegister() }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Einladungscode</Label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="WEIN-2026-ABC"
              required
            />
          </div>
          {registerError && <p className="text-sm text-destructive">{registerError}</p>}
          <SubmitButton isPending={isPending} className="w-full">Account erstellen</SubmitButton>
        </form>
        <div className="mt-3 text-sm text-muted-foreground text-center">
          Bereits registriert?{' '}
          <Link href="/login" className="hover:text-foreground underline">Anmelden</Link>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Start dev server and test happy path**

```bash
npm run dev
```

Navigate to `http://localhost:3000/register`.

Test happy path:
1. Enter email (use a new address not in Supabase), password (≥8 chars), and the test code `TEST-CODE-001` inserted in Task 1
2. Click "Account erstellen"
3. Expected: redirect to `/`, user is logged in

In Supabase Dashboard → `invitation_codes`: verify `used_at` is set and `used_by` matches the new user's ID.

- [ ] **Step 4: Test error cases**

With dev server running:

1. **Invalid code** — enter any random string as code → expect red error "Ungültiger Einladungscode"
2. **Already-used code** — try `TEST-CODE-001` again (just used) → expect "Ungültiger Einladungscode"
3. **Already-registered email** — try registering the same email with a fresh code → expect "Diese E-Mail-Adresse ist bereits registriert"
4. **Already logged in** — navigate to `/register` while logged in → expect redirect to `/`
5. **Password too short** — enter 7-char password → expect browser-native validation (HTML5 `minLength`)

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/register/page.tsx app/\(auth\)/register/register-form.tsx
git commit -m "feat: add /register page with invitation code form"
```

---

### Task 4: Add register link to login form

**Files:**
- Modify: `app/(auth)/login/login-form.tsx`

**Interfaces:**
- Consumes: existing `LoginForm` component
- Produces: `LoginForm` with a "Noch kein Account? Registrieren →" link below the Card

- [ ] **Step 1: Add `Link` import and the register link**

In `app/(auth)/login/login-form.tsx`:

Add `import Link from 'next/link'` to the existing imports.

In the main login view's return (after the `</form>` closing tag and after the "Passwort vergessen?" button), add:

```tsx
<Link
  href="/register"
  className="mt-2 text-sm text-muted-foreground hover:text-foreground w-full text-center block"
>
  Noch kein Account? Registrieren →
</Link>
```

The full bottom section of the login card should look like:

```tsx
        <button
          type="button"
          onClick={() => setView('forgot')}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          Passwort vergessen?
        </button>
        <Link
          href="/register"
          className="mt-2 text-sm text-muted-foreground hover:text-foreground w-full text-center block"
        >
          Noch kein Account? Registrieren →
        </Link>
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/login`.

Expected:
- "Noch kein Account? Registrieren →" link appears below "Passwort vergessen?"
- Clicking it navigates to `/register`
- Existing login functionality is unaffected

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/login/login-form.tsx
git commit -m "feat: add register link to login form"
```
