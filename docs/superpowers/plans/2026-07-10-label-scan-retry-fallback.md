# Label Scan Retry & Fallback Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `scanWineLabel` resilient to transient Gemini `503`/`429` capacity errors by retrying the primary model with backoff, then falling back to a second Gemini model, without changing behavior for non-transient (client) errors.

**Architecture:** All logic lives in the existing single file `lib/actions/scan-label.ts` — no new modules. A new internal helper, `generateLabelScan()`, wraps the existing `model.generateContent(...)` call with a retry loop (up to 3 attempts, backoff 500ms/1000ms) that only retries on errors classified as transient by a new `isRetryableError()` helper. If the primary model exhausts its retries, one fallback attempt is made against a second model. Whichever model succeeds is reported back so the existing `api_usage_logs` insert logs the model that was actually used.

**Tech Stack:** TypeScript, Next.js Server Actions, `@google/generative-ai` SDK, Vitest + jsdom for tests.

## Global Constraints

- Primary model env var stays `GEMINI_MODEL` (default `gemini-2.0-flash`, unchanged).
- New fallback model env var: `GEMINI_FALLBACK_MODEL`, default `gemini-1.5-flash`.
- Retry budget is hardcoded, not configurable: 3 total primary attempts (initial + 2 retries), backoff `500ms` then `1000ms`, plus exactly 1 fallback attempt. No env-configurable retry counts.
- Retryable errors: Gemini SDK error with `status === 503`, `status === 429`, or no `.status` property at all (network-level failure). Everything else (400/401/403/404) is non-retryable and fails immediately with no fallback attempt.
- The two existing German user-facing error strings (`'Scan fehlgeschlagen, bitte erneut versuchen'`, `'Etikett konnte nicht gelesen werden'`, etc.) are unchanged.
- No changes to `components/cellar/scan-label-button.tsx` or `lib/offline/scan-sync.ts` — both already handle `result.error` generically.
- **Node version note for running tests:** this repo's local default Node (`v20.11.0` via `nvm`) fails at Vitest startup entirely (`node:util` doesn't export `styleText`) — a pre-existing environment issue unrelated to this change. Run tests with Node 22 instead: `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v22.23.0` (or any installed `v22.x`) before running `npx vitest`.

---

## Task 1: Add retry + fallback logic to `scanWineLabel`

**Files:**
- Modify: `lib/actions/scan-label.ts`
- Test: `lib/actions/__tests__/scan-label.test.ts` (new file — no test directory exists under `lib/actions/` today)

**Interfaces:**
- Consumes: existing `GoogleGenerativeAI` class and `Part`/`GenerateContentResult` types from `@google/generative-ai`; existing `createClient`/`createAdminClient` from `@/lib/supabase/server`.
- Produces: `scanWineLabel(formData: FormData): Promise<ScanResult & { error?: string }>` — same public signature as today, no caller changes needed.

- [ ] **Step 1: Write the failing tests**

Create `lib/actions/__tests__/scan-label.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()
const mockGetGenerativeModel = vi.fn(() => ({ generateContent: mockGenerateContent }))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}))

const mockGetUser = vi.fn()
const mockMembershipMaybeSingle = vi.fn()
const mockUsageInsert = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'api_usage_logs') {
    return { insert: mockUsageInsert }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

import { scanWineLabel } from '../scan-label'

function makeError(status: number) {
  const err = new Error(`status ${status}`) as Error & { status: number }
  err.status = status
  return err
}

function makeSuccessResult(json: Record<string, unknown> = { name: 'Barolo' }) {
  return {
    response: {
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      text: () => JSON.stringify(json),
    },
  }
}

function makeFormData(): FormData {
  const fd = new FormData()
  fd.set('image', new File(['fake-image-bytes'], 'label.jpg', { type: 'image/jpeg' }))
  return fd
}

describe('scanWineLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockUsageInsert.mockResolvedValue({ error: null })
  })

  it('retries the primary model on a transient 503 then succeeds', async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(makeError(503))
      .mockResolvedValueOnce(makeSuccessResult({ name: 'Barolo' }))

    const promise = scanWineLabel(makeFormData())
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.error).toBeUndefined()
    expect(result.name).toBe('Barolo')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash' })
    )
  })

  it('falls back to the fallback model after the primary exhausts retries', async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockResolvedValueOnce(makeSuccessResult({ name: 'Chianti' }))

    const promise = scanWineLabel(makeFormData())
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.error).toBeUndefined()
    expect(result.name).toBe('Chianti')
    expect(mockGenerateContent).toHaveBeenCalledTimes(4)
    expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(4, { model: 'gemini-1.5-flash' })
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-1.5-flash' })
    )
  })

  it('fails fast on a non-retryable error without trying the fallback', async () => {
    mockGenerateContent.mockRejectedValueOnce(makeError(400))

    const result = await scanWineLabel(makeFormData())

    expect(result.error).toBe('Scan fehlgeschlagen, bitte erneut versuchen')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(mockUsageInsert).not.toHaveBeenCalled()
  })

  it('returns the generic error when both the primary and fallback are exhausted', async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))

    const promise = scanWineLabel(makeFormData())
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.error).toBe('Scan fehlgeschlagen, bitte erneut versuchen')
    expect(mockGenerateContent).toHaveBeenCalledTimes(4)
    expect(mockUsageInsert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (Node 22 required — see Global Constraints):
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v22.23.0
npx vitest run lib/actions/__tests__/scan-label.test.ts
```
Expected: FAIL. The current implementation has no retry loop, so:
- Test 1 fails because `generateContent` is only called once (no retry on the first `503`), so the mock's `mockRejectedValueOnce(makeError(503))` becomes the actual thrown error and `result.error` is `'Scan fehlgeschlagen, bitte erneut versuchen'` instead of the expected success.
- Test 2 fails the same way — `generateContent` is called once, not 4 times.
- Test 3 passes already (current code already fails fast on any error) — that's fine, it stays green through the refactor.
- Test 4 fails because `mockGenerateContent` is called once, not 4 times, and `api_usage_logs.insert` model field assertion doesn't apply here (this test doesn't check the model field, only call count — it will fail on the call-count assertion).

- [ ] **Step 3: Implement the retry + fallback logic**

Replace the full contents of `lib/actions/scan-label.ts` with:

```ts
'use server'

import {
  GoogleGenerativeAI,
  type GenerateContentResult,
  type Part,
} from '@google/generative-ai'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MODEL          = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-1.5-flash'
const INPUT_COST  = 0.10 / 1_000_000
const OUTPUT_COST = 0.40 / 1_000_000

const MAX_PRIMARY_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [500, 1000]

export interface ScanResult {
  name?: string
  producer?: string
  vintage?: number | null
  type?: 'red' | 'white' | 'rosé' | 'sparkling'
  country?: string
  region?: string
  grape_variety?: string
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  return status === undefined || status === 503 || status === 429
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function generateLabelScan(
  client: GoogleGenerativeAI,
  parts: Part[],
): Promise<{ result: GenerateContentResult; usedModel: string }> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_PRIMARY_ATTEMPTS; attempt++) {
    try {
      const model = client.getGenerativeModel({ model: MODEL })
      const result = await model.generateContent(parts)
      return { result, usedModel: MODEL }
    } catch (err) {
      lastError = err
      if (!isRetryableError(err)) throw err
      if (attempt < MAX_PRIMARY_ATTEMPTS - 1) await sleep(RETRY_BACKOFF_MS[attempt])
    }
  }

  console.error('[scan-label] primary model exhausted retries, trying fallback:', lastError)
  const fallbackModel = client.getGenerativeModel({ model: FALLBACK_MODEL })
  const result = await fallbackModel.generateContent(parts)
  return { result, usedModel: FALLBACK_MODEL }
}

export async function scanWineLabel(
  formData: FormData,
): Promise<ScanResult & { error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet' }

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return { error: 'Keine Familie gefunden' }

  const image = formData.get('image') as File | null
  if (!image || image.size === 0) return { error: 'Kein Bild' }

  const bytes = await image.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type)
    ? image.type
    : 'image/jpeg'

  const client = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

  const parts: Part[] = [
    { inlineData: { mimeType, data: base64 } },
    {
      text: `Analysiere dieses Weinetikett und antworte NUR mit einem JSON-Objekt (kein Markdown, keine Erklärungen):

{
  "name": "Weinname (z.B. Barolo, Chianti Classico)",
  "producer": "Produzent / Weingut",
  "vintage": 2018,
  "type": "red" | "white" | "rosé" | "sparkling",
  "country": "Land auf Englisch (z.B. Italy, France, Germany)",
  "region": "Region (z.B. Toscana, Bordeaux, Rheingau)",
  "grape_variety": "Rebsorte(n) (z.B. Sangiovese, Cabernet Sauvignon)"
}

Felder die du nicht erkennst, lasse vollständig weg. "vintage" muss eine 4-stellige Jahreszahl sein.`,
    },
  ]

  let result: GenerateContentResult
  let usedModel: string
  try {
    ({ result, usedModel } = await generateLabelScan(client, parts))
  } catch (err) {
    console.error('[scan-label] Gemini API error:', err)
    return { error: 'Scan fehlgeschlagen, bitte erneut versuchen' }
  }

  const inputTokens  = result.response.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0
  const costUsd = inputTokens * INPUT_COST + outputTokens * OUTPUT_COST

  const { error: logError } = await admin.from('api_usage_logs').insert({
    family_id:     membership.family_id,
    feature:       'label_scan',
    model:         usedModel,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    cost_usd:      costUsd,
  })
  if (logError) console.error('[scan-label] usage log failed:', logError.message)

  const raw = result.response.text()
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { error: 'Etikett konnte nicht gelesen werden' }
    const p = JSON.parse(jsonMatch[0])
    const currentYear = new Date().getFullYear()
    return {
      name:          p.name          || undefined,
      producer:      p.producer      || undefined,
      vintage:       typeof p.vintage === 'number' && p.vintage > 1900 && p.vintage <= currentYear + 1
                       ? p.vintage : undefined,
      type:          ['red', 'white', 'rosé', 'sparkling'].includes(p.type) ? p.type : undefined,
      country:       p.country       || undefined,
      region:        p.region        || undefined,
      grape_variety: p.grape_variety || undefined,
    }
  } catch {
    return { error: 'Etikett konnte nicht gelesen werden' }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v22.23.0
npx vitest run lib/actions/__tests__/scan-label.test.ts
```
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run:
```bash
npx vitest run
```
Expected: PASS — no other test touches `lib/actions/scan-label.ts`, so this is a check that nothing else broke (e.g. a TypeScript import issue).

- [ ] **Step 6: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors. This confirms the `Part`/`GenerateContentResult` type imports from `@google/generative-ai` resolve correctly and the destructuring assignment `;({ result, usedModel } = await generateLabelScan(client, parts))` type-checks.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/scan-label.ts lib/actions/__tests__/scan-label.test.ts
git commit -m "$(cat <<'EOF'
fix: retry transient Gemini errors and fall back to a second model

503/429/network errors on the primary label-scan model now retry with
backoff (3 attempts) before falling back once to a second Gemini model,
instead of failing the scan immediately. Non-transient errors still fail
fast with no fallback.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** error classification (✓ `isRetryableError`), retry+backoff flow (✓ `generateLabelScan` loop), fallback model config (✓ `FALLBACK_MODEL` env var), usage logging of actual model (✓ `usedModel` in insert), unchanged user-facing errors (✓ same strings), testing (✓ all 4 spec test cases covered). No gaps found.
- **Placeholder scan:** none — every step has runnable code and exact commands.
- **Type consistency:** `generateLabelScan(client: GoogleGenerativeAI, parts: Part[])` returns `{ result: GenerateContentResult; usedModel: string }` — matches the destructuring `let result: GenerateContentResult; let usedModel: string` in `scanWineLabel` exactly.
