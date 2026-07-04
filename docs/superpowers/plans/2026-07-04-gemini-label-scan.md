# Gemini Label Scan Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Anthropic Claude Haiku API call in the wine label scan feature with Google Gemini 2.0 Flash, reducing per-scan cost by ~10×.

**Architecture:** Surgical swap inside `lib/actions/scan-label.ts` — replace `@anthropic-ai/sdk` with `@google/generative-ai`, update pricing constants, update the API call shape. No other files change.

**Tech Stack:** Next.js App Router server actions, `@google/generative-ai` SDK, Supabase admin client.

## Global Constraints

- No test framework — verification is manual (build + browser)
- No Tailwind color classes — CSS custom properties only (`var(--primary)`, etc.)
- Model ID (exact): `gemini-2.0-flash`
- Gemini 2.0 Flash pricing: input `$0.10 / 1_000_000 tokens`, output `$0.40 / 1_000_000 tokens`
- `feature` log value (exact string): `'label_scan'`
- Env var: `GOOGLE_GENERATIVE_AI_API_KEY` (replaces `ANTHROPIC_API_KEY`)
- Do not add comments to code unless the WHY is non-obvious

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Remove `@anthropic-ai/sdk`, add `@google/generative-ai` |
| `lib/actions/scan-label.ts` | Rewrite | Gemini API call, updated pricing, same interface |
| `.env.local` | Modify | Replace `ANTHROPIC_API_KEY` with `GOOGLE_GENERATIVE_AI_API_KEY` |

---

## Task 1: Swap SDK and Rewrite Server Action

**Files:**
- Modify: `package.json`
- Rewrite: `lib/actions/scan-label.ts`
- Modify: `.env.local`

**Interfaces:**
- Produces (unchanged from current):
  ```ts
  export interface ScanResult {
    name?: string
    producer?: string
    vintage?: number | null
    type?: 'red' | 'white' | 'rosé' | 'sparkling'
    country?: string
    region?: string
    grape_variety?: string
  }
  export async function scanWineLabel(formData: FormData): Promise<ScanResult & { error?: string }>
  ```

- [ ] **Step 1: Remove Anthropic SDK, install Gemini SDK**

```bash
npm uninstall @anthropic-ai/sdk
npm install @google/generative-ai
```

Expected: `package.json` no longer contains `@anthropic-ai/sdk`; `@google/generative-ai` appears under `dependencies`.

- [ ] **Step 2: Add the Google API key to `.env.local`**

Open `.env.local` and add:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```

Get the key from [Google AI Studio](https://aistudio.google.com/app/apikey). Leave `ANTHROPIC_API_KEY` in place for now — it will be removed in Task 2 after smoke testing.

- [ ] **Step 3: Rewrite `lib/actions/scan-label.ts`**

Replace the entire file with:

```ts
'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MODEL = 'gemini-2.0-flash'
const INPUT_COST  = 0.10 / 1_000_000
const OUTPUT_COST = 0.40 / 1_000_000

export interface ScanResult {
  name?: string
  producer?: string
  vintage?: number | null
  type?: 'red' | 'white' | 'rosé' | 'sparkling'
  country?: string
  region?: string
  grape_variety?: string
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
  const model = client.getGenerativeModel({ model: MODEL })

  let result
  try {
    result = await model.generateContent([
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
    ])
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
    model:         MODEL,
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

- [ ] **Step 4: Verify the build passes**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -10
```

Expected: `✓ Compiled` with no TypeScript errors. If you see `Cannot find module '@anthropic-ai/sdk'`, you have a stale import somewhere — grep for it:

```bash
grep -r "anthropic-ai" . --include="*.ts" --include="*.tsx" | grep -v node_modules
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/actions/scan-label.ts
git commit -m "feat: migrate label scan from Anthropic to Gemini 2.0 Flash"
```

---

## Task 2: Smoke Test and Key Cleanup

**Files:**
- Modify: `.env.local` (remove old key)

**Interfaces:**
- Consumes: `scanWineLabel` from Task 1

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test scan in QuickAddSheet**

1. Open `/cellar` in the browser
2. Tap `+` on any storage location group
3. Tap "Etikett scannen"
4. Pick a wine bottle photo from your device
5. Confirm fields pre-fill (name, producer, vintage, type at minimum)

- [ ] **Step 3: Test scan in WineForm**

1. Open `/wine/new`
2. Tap "Etikett scannen"
3. Pick a wine bottle photo
4. Confirm fields pre-fill

- [ ] **Step 4: Verify cost logging**

Open Supabase dashboard → Table Editor → `api_usage_logs`.

Confirm the two new rows have:
- `model = 'gemini-2.0-flash'`
- `feature = 'label_scan'`
- `cost_usd` is a small non-zero value (expect roughly `0.000030` to `0.000100` per scan)
- `input_tokens` and `output_tokens` are non-zero

- [ ] **Step 5: Remove the old Anthropic key from `.env.local`**

Delete this line from `.env.local`:

```
ANTHROPIC_API_KEY=...
```

- [ ] **Step 6: Remove `ANTHROPIC_API_KEY` from Vercel**

In the Vercel dashboard → Project → Settings → Environment Variables, delete `ANTHROPIC_API_KEY` and add `GOOGLE_GENERATIVE_AI_API_KEY` with your key value. Apply to Production, Preview, and Development environments.

- [ ] **Step 7: Commit**

```bash
git add .env.local
git commit -m "chore: remove ANTHROPIC_API_KEY, switch to GOOGLE_GENERATIVE_AI_API_KEY"
```

Note: `.env.local` is gitignored — this commit will be empty if so. That is fine; skip it if git reports nothing to commit.
