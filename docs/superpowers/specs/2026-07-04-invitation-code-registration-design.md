# Invitation Code Registration — Design Spec

**Date:** 2026-07-04
**Status:** Approved

---

## Overview

Gate new account creation behind single-use invitation codes. The app is a private family wine cellar — registration must be controlled. Codes are created manually in the Supabase Dashboard and consumed exactly once when a new user registers.

---

## Goals

- Only users with a valid, unused invitation code can register
- Codes are single-use: marked consumed immediately after successful registration
- No admin UI needed — codes are managed directly in the Supabase Dashboard
- Existing login flow is unchanged except for a link to the new register page

---

## Data Model

### `invitation_codes`

| Column | Type | Notes |
|---|---|---|
| `code` | `text` PRIMARY KEY | Human-readable code, e.g. `WEIN-2026-ABC` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | When inserted |
| `used_at` | `timestamptz` | NULL until redeemed |
| `used_by` | `uuid REFERENCES auth.users(id)` | NULL until redeemed |

**RLS:** Row-level security enabled. No client-side read or write access. All validation runs server-side via the admin/service-role client.

---

## Registration Flow

1. User navigates to `/register`
2. Form collects: E-Mail, Passwort (min 8 chars), Einladungscode
3. On submit, `registerWithCode` Server Action runs:
   a. Fetch row from `invitation_codes` where `code = $code AND used_at IS NULL` (admin client)
   b. If not found → return error, abort (no user created)
   c. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
   d. If user creation fails (e.g. email already in use) → return error, code remains unused
   e. Mark code: `UPDATE invitation_codes SET used_at = now(), used_by = newUser.id WHERE code = $code`
   f. Sign in the new user via `supabase.auth.signInWithPassword({ email, password })`
   g. Redirect to `/`

**Error messages (no enumeration):**
- Invalid or already-used code → `"Ungültiger Einladungscode"`
- Email already registered → `"Diese E-Mail-Adresse ist bereits registriert"`
- Generic server error → `"Registrierung fehlgeschlagen"`

---

## Components & Files

### New files

| File | Purpose |
|---|---|
| `supabase/migrations/012_invitation_codes.sql` | Create table, enable RLS, no permissive policies |
| `app/(auth)/register/page.tsx` | Server Component — redirect to `/` if already logged in |
| `app/(auth)/register/register-form.tsx` | Client Component — email + password + code form |
| `lib/actions/auth.ts` | Server Action `registerWithCode(email, password, code)` |

### Modified files

| File | Change |
|---|---|
| `app/(auth)/login/login-form.tsx` | Add "Noch kein Account? Registrieren →" link below the Card |

### No changes needed

- `app/(auth)/layout.tsx` — `/register` shares the existing auth layout
- Auth callback — no changes required
- Existing login flow — untouched

---

## Security Notes

- Code validation uses the admin client (service role) — codes are never exposed to the browser
- No timing difference between "code not found" and "code already used" (same error message)
- User creation happens only after code is validated — no orphaned users possible
- Code is marked used only after successful user creation — no double-spend risk from the server action running atomically (validate → create → mark used)

---

## Out of Scope

- Admin UI for managing codes
- Expiry dates on codes
- Multi-use codes
- Email verification flow (Supabase's `email_confirm: true` handles this)
