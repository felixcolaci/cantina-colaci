# Family-Seite Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Family page with an editorial layout, readable member names (with a first-visit set-name prompt and stift-icon edit), replacing all shadcn Cards/Badges with inline CSS token styles.

**Architecture:** Three tasks in dependency order: (1) DB migration adds `display_name` column, (2) server action + two new client components (`SetNamePrompt`, `EditNameSheet`), (3) `page.tsx` redesign that fetches emails via `admin.auth.admin.listUsers()` and renders the editorial layout using those components. Actions use plain `<form action={...}>` with server-side `redirect('/family')` on success.

**Tech Stack:** Next.js App Router (Server + Client Components), Supabase Admin SDK (`auth.admin.listUsers`), CSS custom properties design system.

## Global Constraints

- All visual tokens via `var(--...)` — no hardcoded hex or Tailwind color classes
- No shadcn `Card`, `CardHeader`, `CardTitle`, `Badge` — plain styled elements only
- Display font: `var(--font-display)` (Cormorant Garamond)
- Body font: `var(--font-body)` (Plus Jakarta Sans)
- Mono font: `var(--font-mono)` (DM Mono)
- CSS utility classes available: `eyebrow`, `rule-gold`, `display-hero`, `nums` (defined in `app/globals.css`)
- Server actions: authorize via `user.id`, end with `redirect('/family')` (no `revalidatePath` needed)
- Run build: `npm run build`

---

### Task 1: DB Migration — add `display_name` to `family_members`

**Files:**
- Supabase migration (via MCP tool `apply_migration`)

**Interfaces:**
- Produces: `family_members.display_name TEXT` — nullable column, available to all subsequent tasks

- [ ] **Step 1: Apply migration via Supabase MCP**

Use the `mcp__claude_ai_Supabase__apply_migration` tool with:
- `name`: `add_display_name_to_family_members`
- `query`:
```sql
ALTER TABLE family_members ADD COLUMN display_name TEXT;
```

- [ ] **Step 2: Verify column exists**

Use `mcp__claude_ai_Supabase__execute_sql` to confirm:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'family_members' AND column_name = 'display_name';
```

Expected: one row — `display_name | text | YES`

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: apply migration add_display_name_to_family_members"
```

---

### Task 2: `setDisplayName` action + `SetNamePrompt` + `EditNameSheet`

**Files:**
- Create: `lib/actions/family.ts`
- Create: `app/family/set-name-prompt.tsx`
- Create: `app/family/edit-name-sheet.tsx`

**Interfaces:**
- Consumes: `family_members.display_name` column from Task 1
- Produces:
  - `setDisplayName(formData: FormData): Promise<void>` — exported from `lib/actions/family.ts`
  - `SetNamePrompt({ emailPrefix: string })` — exported from `app/family/set-name-prompt.tsx`
  - `EditNameSheet({ currentName: string })` — exported from `app/family/edit-name-sheet.tsx`

- [ ] **Step 1: Create `lib/actions/family.ts`**

```ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function setDisplayName(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawName = formData.get('display_name') as string
  const display_name = rawName?.trim().slice(0, 40) || null

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  await admin
    .from('family_members')
    .update({ display_name })
    .eq('user_id', user.id)
    .eq('family_id', membership.family_id)

  redirect('/family')
}
```

- [ ] **Step 2: Create `app/family/set-name-prompt.tsx`**

```tsx
'use client'

import { setDisplayName } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SetNamePrompt({ emailPrefix }: { emailPrefix: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in oklab, var(--primary) 6%, var(--background))',
        border: '1px solid color-mix(in oklab, var(--primary) 20%, transparent)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--foreground)',
          fontWeight: 500,
          marginBottom: 'var(--space-3)',
        }}
      >
        Wie möchtest du heißen?
      </p>
      <form action={setDisplayName} style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input
          name="display_name"
          defaultValue={emailPrefix}
          maxLength={40}
          style={{ flex: 1 }}
        />
        <Button type="submit">Speichern</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/family/edit-name-sheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { setDisplayName } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'

export function EditNameSheet({ currentName }: { currentName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <button
          aria-label="Namen bearbeiten"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Pencil size={14} />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Namen ändern</SheetTitle>
        </SheetHeader>
        <form action={setDisplayName} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Anzeigename</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={currentName}
              maxLength={40}
            />
          </div>
          <Button type="submit" className="w-full">Speichern</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/family.ts app/family/set-name-prompt.tsx app/family/edit-name-sheet.tsx
git commit -m "feat: add setDisplayName action and SetNamePrompt/EditNameSheet components"
```

---

### Task 3: Family page editorial redesign

**Files:**
- Modify: `app/family/page.tsx`

**Interfaces:**
- Consumes:
  - `SetNamePrompt({ emailPrefix: string })` from `./set-name-prompt`
  - `EditNameSheet({ currentName: string })` from `./edit-name-sheet`
  - `admin.auth.admin.listUsers()` — returns `{ data: { users: Array<{ id: string; email?: string }> } }`

- [ ] **Step 1: Replace `app/family/page.tsx`**

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { FamilyRole } from '@/lib/types'
import { CopyInviteLink } from './copy-invite-link'
import { StartOwnCellar } from './start-own-cellar'
import { SetNamePrompt } from './set-name-prompt'
import { EditNameSheet } from './edit-name-sheet'

type MemberWithName = {
  user_id: string
  role: FamilyRole
  display_name: string | null
  email: string
  resolvedName: string
  initials: string
}

function emailPrefix(email: string): string {
  const prefix = email.split('@')[0] ?? email
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    const s = name.slice(0, 2).toUpperCase()
    return s.length < 2 ? s + s : s
  }
  return words.map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
}

export default async function FamilyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id, role, families(name, is_demo)')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const [membersResult, authResult] = await Promise.all([
    admin
      .from('family_members')
      .select('user_id, role, display_name')
      .eq('family_id', membership.family_id),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ])

  const emailMap = new Map(
    (authResult.data?.users ?? []).map(u => [u.id, u.email ?? ''])
  )
  const family = membership.families as any

  const members: MemberWithName[] = (membersResult.data ?? []).map(m => {
    const email = emailMap.get(m.user_id) ?? ''
    const display_name = (m as any).display_name as string | null
    const resolvedName = display_name ?? emailPrefix(email)
    return {
      user_id: m.user_id,
      role: m.role as FamilyRole,
      display_name,
      email,
      resolvedName,
      initials: getInitials(resolvedName),
    }
  })

  const currentMember = members.find(m => m.user_id === user.id)
  const showNamePrompt = !currentMember?.display_name
  const currentEmailPrefix = emailPrefix(currentMember?.email ?? '')

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Familie</p>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-display)',
          lineHeight: 'var(--leading-display)',
          marginBottom: 'var(--space-4)',
        }}
      >
        {family?.name}
      </h1>
      <hr className="rule-gold" style={{ marginBottom: 'var(--space-6)' }} />

      {showNamePrompt && <SetNamePrompt emailPrefix={currentEmailPrefix} />}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {members.map(m => (
          <div
            key={m.user_id}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {m.initials}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                color: 'var(--foreground)',
                flex: 1,
              }}
            >
              {m.resolvedName}
            </span>
            {m.role === 'owner' && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--primary)',
                }}
              >
                Owner
              </span>
            )}
            {m.user_id === user.id && m.display_name && (
              <EditNameSheet currentName={m.display_name} />
            )}
          </div>
        ))}
      </div>

      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--border)',
          marginBottom: 'var(--space-6)',
        }}
      />

      {family?.is_demo && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              marginBottom: 'var(--space-2)',
            }}
          >
            Demo-Modus
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--muted-foreground)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Du nutzt aktuell die Demo-Cantina mit Beispielweinen. Starte jetzt mit deinen eigenen.
          </p>
          <StartOwnCellar />
        </div>
      )}

      {membership.role === 'owner' && (
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              marginBottom: 'var(--space-2)',
            }}
          >
            Mitglied einladen
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--muted-foreground)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Link teilen. Nach dem Anmelden wird das Mitglied automatisch zur Familie hinzugefügt.
          </p>
          <CopyInviteLink familyId={membership.family_id} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/family/page.tsx
git commit -m "feat: editorial redesign of Family page with readable member names"
```
