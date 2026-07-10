# Label Scan Success Message

**Date:** 2026-07-11
**Status:** Approved

---

## Overview

`ScanLabelButton` (`components/cellar/scan-label-button.tsx`) already shows an inline error message (`error` state) and an offline-save confirmation (`savedOffline` state) below the scan button, but gives no visual confirmation on a successful online scan — the user only sees the surrounding form fields populate. This adds a small success confirmation line, consistent with the component's existing inline-message pattern.

## Behavior

On a successful `scanWineLabel` result (the `else` branch in `handleChange`, right before `onResult(result)` is called):

- Set a new `success` boolean state to `true`.
- Render `<p style={{ color: 'var(--success)', fontSize: 'var(--text-sm)', marginTop: 4 }}>Etikett erkannt ✓</p>` below the button, in the same position/style pattern as the existing `error` and `savedOffline` messages (mutually exclusive — only one of `error`/`savedOffline`/`success` is ever true at a time).
- Auto-hide after 3 seconds via `setTimeout`, clearing the timeout on unmount.
- Also clear `success` at the start of the next scan attempt (`handleChange`'s existing `setError(null)` / `setSavedOffline(false)` reset block gets a matching `setSuccess(false)`).

Uses the `--success` CSS variable already defined in `app/globals.css` (`#5d7a4f` light / dark-mode equivalent) — currently defined but unused anywhere in the codebase, so this is its first consumer.

## Out of Scope

- No change to `scanWineLabel`, `wine-form.tsx`, or `quick-add-sheet.tsx` — purely presentational, contained to `ScanLabelButton`.
- No toast/global notification system — this is a local, inline message matching the component's existing style.
