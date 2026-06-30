---
title: Password Login (Magic Link Removal)
date: 2026-06-30
status: approved
---

# Password Login (Magic Link Removal)

## Goal

Replace the magic link (OTP) login with email + password login. Add a "Passwort vergessen" flow so users can set or reset their password via a one-time email link.

## Motivation

Supabase Free Tier limits OTP emails to ~2/day. Password login eliminates the email dependency for daily testing and production use.

## Login Form (`app/(auth)/login/login-form.tsx`)

- Fields: E-Mail + Passwort
- Submit: `supabase.auth.signInWithPassword({ email, password })`
- Error: generic "E-Mail oder Passwort falsch" (no enumeration of which field is wrong)
- Link below form: "Passwort vergessen?" → switches Card to forgot-password view (inline, no route change)
- Magic link (`signInWithOtp`) is completely removed

## Passwort vergessen (inline in login Card)

- Triggered by "Passwort vergessen?" link on the login form
- Card switches to an email input + "Link senden" button
- Calls: `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth/callback?next=/login/reset-password' })`
- On success: confirmation text "Schau in deine Mails — wir haben dir einen Reset-Link geschickt"
- Back link: "Zurück zum Login" → switches Card back to login view

## Passwort setzen (`/login/reset-password`)

- New page in `(auth)` group → no TopBar/BottomNav
- User arrives here after `/auth/callback` exchanges the reset token and sets a Recovery session
- Fields: neues Passwort + Passwort bestätigen (client-side match check)
- Minimum password length: 8 characters (Supabase default)
- Submit: `supabase.auth.updateUser({ password: newPassword })`
- On success: `router.push('/')` — user is already authenticated

## Auth Callback (`app/auth/callback/route.ts`)

- No changes needed — already handles token exchange via `exchangeCodeForSession`
- The `?next` param routing already works for `/login/reset-password`

## What Is Removed

- `signInWithOtp` call and all related logic in `login-form.tsx`
- The `auth_next` cookie trick (was only needed for OTP redirect)

## Files

| Action | File |
|--------|------|
| Modify | `app/(auth)/login/login-form.tsx` |
| Create | `app/(auth)/login/reset-password/page.tsx` |

## States in LoginForm

The `LoginForm` component manages three views via a `view` state:

1. `'login'` — email + password fields (default)
2. `'forgot'` — email field + send reset link
3. `'forgot-sent'` — confirmation message

The reset-password page is a separate route, not a LoginForm view.
