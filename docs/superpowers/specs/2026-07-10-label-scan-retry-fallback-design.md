# Label Scan Retry & Fallback Model

**Date:** 2026-07-10
**Status:** Approved

---

## Overview

`scanWineLabel` (`lib/actions/scan-label.ts`) makes a single Gemini `generateContent` call with no retry logic. Any failure — including transient `503 Service Unavailable` capacity errors, which are happening frequently enough to block real usage — is caught by one generic `try/catch` and immediately returned to the user as `'Scan fehlgeschlagen, bitte erneut versuchen'`.

This spec adds retry-with-backoff on the primary model plus a one-shot fallback to a second Gemini model, scoped to transient/capacity errors only. Client-type errors (bad image, bad request) still fail fast with the existing message — retrying or switching models won't fix those.

Both callers of `scanWineLabel` (`components/cellar/scan-label-button.tsx`, `lib/offline/scan-sync.ts`) already just `await` the action and branch on `result.error`; neither needs to change. The `ScanLabelButton` component already shows a persistent "Etikett wird gelesen…" spinner for the full duration of the call, so retries are invisible to the user — no new loading states needed.

---

## Error classification

A new helper, `isRetryableError(err: unknown): boolean`, decides whether an error is worth retrying:

- **Retryable:** the Gemini SDK error has `status === 503` or `status === 429`, or has no `.status` at all (network-level failures, e.g. `fetch failed`, `ECONNRESET`).
- **Non-retryable:** any other `.status` (400, 401, 403, 404, etc.) — these indicate a problem with the request itself (malformed image, bad API key, unsupported content), not transient capacity. Fail immediately with the existing error message, skip the fallback model entirely.

---

## Retry + fallback flow

Replace the current single `try { model.generateContent(...) } catch` block with a helper that attempts the primary model with retries, then falls back:

```
attempt primary model (initial + 2 retries = 3 total tries)
  backoff between tries: 500ms, then 1000ms
  ├─ success → use result, record which model served it
  ├─ non-retryable error → return error immediately, no fallback
  └─ all 3 tries exhausted (still retryable) → attempt fallback model once
       ├─ success → use result, record which model served it
       └─ failure (retryable or not) → return existing error message
```

Worst case added latency: ~1.5s of backoff plus one extra request beyond today's single call — stays safely under the ~10s default serverless function timeout (no `maxDuration` is currently configured).

Both the primary-model loop and the fallback attempt reuse the same request payload (image + prompt) already built earlier in the function — no duplication of that construction.

---

## Model configuration

```ts
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-1.5-flash'
```

Both are plain Gemini models accessed via the existing `@google/generative-ai` client — no new SDK, no new API key, no new provider integration.

---

## Usage logging

The `api_usage_logs` insert currently hardcodes `model: MODEL`. It changes to log whichever model actually produced the successful response (primary or fallback), so fallback usage is visible in cost tracking:

```ts
await admin.from('api_usage_logs').insert({
  family_id:     membership.family_id,
  feature:       'label_scan',
  model:         usedModel, // 'gemini-2.0-flash' or the fallback model, whichever succeeded
  input_tokens:  inputTokens,
  output_tokens: outputTokens,
  cost_usd:      costUsd,
})
```

If both models fail, no usage row is inserted (unchanged from today — the log only happens after a successful `generateContent` call).

---

## User-facing behavior

No changes to the two existing German error strings or the calling components. Retries and the fallback attempt happen entirely inside `scanWineLabel`; if everything fails, the user still sees `'Scan fehlgeschlagen, bitte erneut versuchen'`.

---

## Testing

New file `lib/actions/__tests__/scan-label.test.ts` (no test file exists for this action today), mocking `@google/generative-ai`'s `GoogleGenerativeAI`/`getGenerativeModel`/`generateContent`. Cases:

1. Primary model fails once with a `503` then succeeds on retry → result returned, `api_usage_logs` logs the primary model.
2. Primary model exhausts all 3 tries with `503` → fallback model succeeds → result returned, `api_usage_logs` logs the fallback model.
3. Primary model fails with a non-retryable `400` → fails immediately, fallback is never called (assert `generateContent` called exactly once).
4. Primary exhausts retries and fallback also fails → existing generic error returned, no `api_usage_logs` insert.

---

## Out of Scope

- A third provider (OpenAI/Anthropic vision) as a second fallback — explicitly ruled out; staying within the Gemini SDK keeps this change small.
- Any change to the offline scan queue (`lib/offline/scan-sync.ts`) or the UI component — both already handle `result.error` generically and need no changes.
- Distinguishing the error message shown to the user by failure type (e.g. "still overloaded" vs "bad image") — out of scope; the existing single generic message is kept.
- Configurable retry counts/backoff via env vars — the tight budget (3 tries, 500ms/1000ms backoff, 1 fallback attempt) is hardcoded, matching the "keep it tight" latency budget chosen for this fix.
