# Form Submission UX — Design Spec
Date: 2026-06-22

## Problem

On mobile, submitting the wine form gives no visual feedback. The submit button stays enabled and the UI appears frozen while the server action runs. Users tap the button multiple times, creating duplicate entries.

Additionally, form errors (network failures, server errors) are thrown but never caught, so failures are silent.

## Goal

- Prevent duplicate submissions on all forms
- Show loading state (disabled button + spinner) during submission
- Show inline German error messages on failure
- Automatically retry network errors up to 3× before surfacing to the user
- Apply consistently to all current and future forms with minimal per-form boilerplate

## Shared Infrastructure

### `lib/hooks/use-server-action.ts`

```ts
useServerAction<T extends unknown[]>(
  action: (...args: T) => Promise<void>
) → { run: (...args: T) => void, isPending: boolean, error: string | null, clearError: () => void }
```

**Internals:**
- Calls `action` inside `useTransition` → `isPending` is `true` while the transition is in flight
- On failure, inspects the error:
  - **Network error** (`TypeError`, message includes `"fetch"` / `"Failed to fetch"` / `"network"`, or `navigator.onLine === false`): retry up to 3× with 500 ms delay between attempts
  - **Non-network error**: bubble immediately, no retries
- After final failure sets `error` to a user-facing German string (see Error Messages below)
- `clearError()` resets `error` to `null`

### `components/ui/submit-button.tsx`

```tsx
<SubmitButton isPending={boolean}>Label</SubmitButton>
```

- `type="submit"`, `disabled={isPending}`
- When pending: renders `<Loader2 className="animate-spin" />` inline before the label text, label opacity reduced slightly
- Thin wrapper — no retry or error logic here

## Error Messages

| Scenario | Message |
|---|---|
| Network error after 3 retries | `"Netzwerkfehler – bitte Verbindung prüfen."` |
| Any other thrown error | `"Fehler beim Speichern – bitte nochmal versuchen."` |

Messages are intentionally generic — server actions must not leak internal error details to the client.

## Per-Form Migration

All forms adopt this 3-part pattern:

1. Replace `action={fn}` with `onSubmit={e => { e.preventDefault(); run(...) }}`
2. Add `{error && <p className="text-sm text-destructive">{error}</p>}` above the submit button
3. Replace `<Button type="submit">` with `<SubmitButton isPending={isPending}>`

### `app/wine/new/wine-form.tsx`
- `run` receives `new FormData(e.currentTarget)`, injects `compressedFile` before calling `addWine`
- Compressed photo closure logic unchanged

### `app/trips/new-trip-form.tsx`
- Currently uncontrolled (`action={createTrip}`)
- Converted to `onSubmit` + `run(new FormData(e.currentTarget))`

### `app/onboarding/onboarding-form.tsx`
- Currently uncontrolled (`action={createFamilyAndCellar}`)
- Converted to `onSubmit` + `run(new FormData(e.currentTarget))`

### `app/wine/[id]/open-bottle-button.tsx`
- Currently uncontrolled (`action={openBottle}`)
- Converted to `onSubmit` + `run(new FormData(e.currentTarget))`

### `app/(auth)/login/login-form.tsx`
- Already has manual `loading`/`error` states
- Adopt `useServerAction` wrapping the Supabase OTP call
- Delete manual `loading` state; keep `sent` state for OTP confirmation screen

## Future Forms

Convention: every new form uses `useServerAction` + `SubmitButton`. No exceptions. This ensures consistent loading and error UX with zero extra per-form logic.

## What This Does Not Cover

- Form validation (HTML `required` attributes remain the mechanism for now)
- Success toasts or confirmation messages (forms redirect on success via `redirect()`)
- Offline queue / background sync (out of scope)
