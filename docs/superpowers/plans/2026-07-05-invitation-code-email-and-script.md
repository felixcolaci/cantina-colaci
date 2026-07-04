# Invitation Code Email Association & Generator Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email validation to invitation codes (only the pre-assigned email can redeem a code) and a CLI script to generate and insert codes.

**Architecture:** A DB migration adds an `email` column to `invitation_codes`. The existing `registerWithCode` action adds a `.eq('email', email.toLowerCase())` filter to the code lookup. A standalone `.mjs` script reads credentials from `.env.local` and inserts codes via the Supabase REST API.

**Tech Stack:** Supabase REST API (fetch), Vitest, Next.js App Router, Node.js 18+ (top-level await via `.mjs`)

## Global Constraints

- Emails stored lowercase in `invitation_codes.email` — script lowercases before insert
- Action normalises email input with `.toLowerCase()` before the query — no `.ilike()`, no wildcard injection risk
- Error message for any code/email mismatch: exactly `'Ungültiger Einladungscode'` (no enumeration)
- Script file: `scripts/gen-invite.mjs` (ESM, top-level await, no build step)
- Code format: `WEIN-XXXX-YYYY` — 4 random chars, dash, 4 random chars; charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no confusable chars)
- Script reads `.env.local` manually — no dotenv dependency
- Script exits with code 1 on error, prints error to stderr

---

### Task 1: DB Migration — add `email` column

**Files:**
- Create: `supabase/migrations/013_invitation_codes_email.sql`

**Interfaces:**
- Produces: `invitation_codes.email text NOT NULL` column; `service_role` access unchanged

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/013_invitation_codes_email.sql
ALTER TABLE invitation_codes ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE invitation_codes ALTER COLUMN email DROP DEFAULT;
```

The two-statement approach first adds the column with a temporary DEFAULT (required when existing rows are present — e.g. the `TEST-CODE-001` row inserted earlier), then removes the default so future inserts must always supply an email.

- [ ] **Step 2: Apply migration via Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste the SQL above → Run.

Expected: query executes without error, `invitation_codes` table now shows an `email` column.

- [ ] **Step 3: Update the test row**

In Supabase Dashboard → SQL Editor, run:

```sql
UPDATE invitation_codes
SET email = 'test@cantina-colaci.test'
WHERE code = 'TEST-CODE-001';
```

Expected: 1 row updated.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/013_invitation_codes_email.sql
git commit -m "feat: add email column to invitation_codes"
```

---

### Task 2: Update `registerWithCode` + tests

**Files:**
- Modify: `lib/actions/auth.ts`
- Modify: `lib/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `registerWithCode(email, password, code)` — same signature, extended query
- Produces: same `Promise<{ error: string | null }>` — now also checks email match

- [ ] **Step 1: Update `mockInviteQuery` in the test file**

The query now chains `.eq('code', ...).eq('email', ...).is('used_at', ...)`. The mock helper must match this new chain. Replace the existing `mockInviteQuery` function in `lib/__tests__/auth.test.ts`:

```ts
function mockInviteQuery(found: boolean) {
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: () => Promise.resolve({ data: found ? { code: 'VALID-CODE' } : null }),
          }),
        }),
      }),
    }),
  })
}
```

- [ ] **Step 2: Add the email-mismatch test case**

Add this test to the `describe('registerWithCode')` block in `lib/__tests__/auth.test.ts`, after the existing "code not found" test:

```ts
it('returns error when email does not match code', async () => {
  mockInviteQuery(false)
  const result = await registerWithCode('wrong@b.com', 'password123', 'VALID-CODE')
  expect(result).toEqual({ error: 'Ungültiger Einladungscode' })
  expect(mockAdminCreateUser).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests and verify they fail**

```bash
nvm use 22 && npx vitest run lib/__tests__/auth.test.ts
```

Expected: tests for "code not found" and "email mismatch" pass (the mock still returns null regardless), but the test that checks the *query shape* may expose the mismatch once the action is updated. At minimum confirm the file loads and the new test runs.

- [ ] **Step 4: Update `registerWithCode` in `lib/actions/auth.ts`**

Replace the code-validation query (lines 16–21) with the email-aware version:

```ts
  const { data: invite } = await admin
    .from('invitation_codes')
    .select('code')
    .eq('code', code)
    .eq('email', email.toLowerCase())
    .is('used_at', null)
    .maybeSingle()
```

The full updated file:

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function registerWithCode(
  email: string,
  password: string,
  code: string,
): Promise<{ error: string | null }> {
  if (password.length < 8) {
    return { error: 'Passwort muss mindestens 8 Zeichen lang sein' }
  }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('invitation_codes')
    .select('code')
    .eq('code', code)
    .eq('email', email.toLowerCase())
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

- [ ] **Step 5: Run tests and verify all 6 pass**

```bash
nvm use 22 && npx vitest run lib/__tests__/auth.test.ts
```

Expected:
```
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

- [ ] **Step 6: Commit**

```bash
git add lib/actions/auth.ts lib/__tests__/auth.test.ts
git commit -m "feat: validate email in registerWithCode"
```

---

### Task 3: Generator script

**Files:**
- Create: `scripts/gen-invite.mjs`

**Interfaces:**
- Consumes: `.env.local` (parsed manually), Supabase REST API
- Produces: CLI tool `node scripts/gen-invite.mjs <email> [count]` that prints generated codes

- [ ] **Step 1: Create `scripts/gen-invite.mjs`**

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [,, email, countArg] = process.argv
const count = parseInt(countArg ?? '1', 10)

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/gen-invite.mjs <email> [count]')
  process.exit(1)
}

if (isNaN(count) || count < 1) {
  console.error('Error: count must be a positive integer')
  process.exit(1)
}

function parseEnvFile(path) {
  try {
    const vars = {}
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      vars[key] = val
    }
    return vars
  } catch {
    return {}
  }
}

const env = parseEnvFile(resolve(process.cwd(), '.env.local'))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  process.exit(1)
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSegment(len) {
  let s = ''
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return s
}

function generateCode() {
  return `WEIN-${randomSegment(4)}-${randomSegment(4)}`
}

async function insertCode(code, email) {
  const res = await fetch(`${url}/rest/v1/invitation_codes`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ code, email: email.toLowerCase() }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to insert code ${code}: ${text}`)
  }
}

for (let i = 0; i < count; i++) {
  const code = generateCode()
  await insertCode(code, email)
  console.log(code)
}
```

- [ ] **Step 2: Test — missing argument**

```bash
node scripts/gen-invite.mjs
```

Expected output (stderr):
```
Usage: node scripts/gen-invite.mjs <email> [count]
```
Expected exit code: 1

- [ ] **Step 3: Test — invalid email**

```bash
node scripts/gen-invite.mjs notanemail
```

Expected output (stderr):
```
Usage: node scripts/gen-invite.mjs <email> [count]
```
Expected exit code: 1

- [ ] **Step 4: Test — generate a single code**

```bash
node scripts/gen-invite.mjs test-invite@cantina-colaci.test
```

Expected: one line printed to stdout in the format `WEIN-XXXX-YYYY` (e.g. `WEIN-A3BK-MN2P`).

Verify in Supabase Dashboard → `invitation_codes`: a new row with that code, `email = 'test-invite@cantina-colaci.test'`, `used_at = NULL`.

- [ ] **Step 5: Test — generate multiple codes**

```bash
node scripts/gen-invite.mjs test-invite2@cantina-colaci.test 3
```

Expected: 3 lines printed, each a distinct `WEIN-XXXX-YYYY` code.

Verify in Supabase Dashboard: 3 new rows with the email `test-invite2@cantina-colaci.test`.

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-invite.mjs
git commit -m "feat: add invitation code generator script"
```
