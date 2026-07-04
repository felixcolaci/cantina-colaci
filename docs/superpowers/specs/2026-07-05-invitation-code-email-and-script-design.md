# Invitation Code — Email Association & Generator Script

**Date:** 2026-07-05
**Status:** Approved

---

## Overview

Extend the existing `invitation_codes` feature with two improvements:
1. Codes are now pre-assigned to a specific email address — only the matching user can redeem them
2. A CLI script generates codes and inserts them directly into the database

---

## Changes

### 1. DB Migration — add `email` column

New migration `supabase/migrations/013_invitation_codes_email.sql`:

```sql
ALTER TABLE invitation_codes ADD COLUMN email text NOT NULL;
```

`service_role` already has full access — no grant changes needed.

### 2. `registerWithCode` update

In `lib/actions/auth.ts`, extend the code validation query to also match `lower(email)`:

```ts
const { data: invite } = await admin
  .from('invitation_codes')
  .select('code')
  .eq('code', code)
  .eq('email', email.toLowerCase())
  .is('used_at', null)
  .maybeSingle()
```

The script always stores emails lowercase. The action normalises the input with `.toLowerCase()` before the query — safe against LIKE-wildcard injection that `.ilike` would allow.

Error message remains `'Ungültiger Einladungscode'` regardless of whether the code doesn't exist, is already used, or the email doesn't match — no enumeration possible.

The existing 5 Vitest tests must be updated: mock setup now includes an `email` field in the returned invite row, and a new test covers email mismatch returning `'Ungültiger Einladungscode'`.

### 3. Generator script

New file `scripts/gen-invite.js` (plain Node.js, no build step):

**Usage:**
```bash
node scripts/gen-invite.js hans@beispiel.de
node scripts/gen-invite.js hans@beispiel.de 3
```

**Behavior:**
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` (parsed manually — no dotenv dependency)
- Generates N codes (default 1) in the format `WEIN-XXXX-YYYY` where X and Y are random uppercase alphanumeric characters
- Inserts each `{ code, email: email.toLowerCase() }` row into `invitation_codes`
- Prints each code to stdout on success
- Exits with code 1 and an error message if env vars are missing or DB insert fails

**Error handling:**
- Missing env vars → `Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local`
- DB insert failure (e.g. duplicate code) → `Error: Failed to insert code WEIN-XXXX-YYYY: <reason>`

---

## Out of Scope

- Updating the `/register` form to show which email the code was issued for
- Expiry dates
- Admin UI
