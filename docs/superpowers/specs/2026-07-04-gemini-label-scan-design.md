# Gemini Label Scan Migration Design

**Date:** 2026-07-04
**Status:** Approved

## Context

The wine label scan feature (`lib/actions/scan-label.ts`) currently calls Claude Haiku 4.5 via `@anthropic-ai/sdk`. Due to pricing concerns, we are switching to Google Gemini 2.0 Flash via the Google AI Studio API. Gemini 2.0 Flash is approximately 10× cheaper on input tokens and 12.5× cheaper on output tokens compared to Claude Haiku.

## Scope

This is a surgical swap contained to `lib/actions/scan-label.ts` and `package.json`. No UI components, no DB migrations, no other files are affected.

| File | Change |
|---|---|
| `package.json` | Remove `@anthropic-ai/sdk`, add `@google/generative-ai` |
| `lib/actions/scan-label.ts` | Replace SDK, client, API call shape, pricing constants |
| `.env.local` | Replace `ANTHROPIC_API_KEY` with `GOOGLE_GENERATIVE_AI_API_KEY` |

Files explicitly unchanged: `components/cellar/scan-label-button.tsx`, `app/(app)/cellar/quick-add-sheet.tsx`, `app/(app)/wine/new/wine-form.tsx`, all DB migrations.

## Model & Pricing

- **Model:** `gemini-2.0-flash`
- **Input cost:** `$0.10 / 1_000_000 tokens`
- **Output cost:** `$0.40 / 1_000_000 tokens`

Previous Anthropic rates were `$1.00` input / `$5.00` output per million tokens.

## API Call Shape

The Gemini SDK (`@google/generative-ai`) replaces the Anthropic SDK. The call structure:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const client = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = client.getGenerativeModel({ model: MODEL })

const result = await model.generateContent([
  { inlineData: { mimeType: mediaType, data: base64 } },
  { text: PROMPT },
])

const inputTokens  = result.response.usageMetadata?.promptTokenCount ?? 0
const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0
const raw = result.response.text()
```

The prompt text (German, structured JSON extraction) is unchanged.

## Media Type Handling

Gemini's `inlineData.mimeType` accepts a plain string — the TypeScript union type cast used by the Anthropic SDK is no longer needed. Supported formats remain JPEG, PNG, WebP, GIF. The fallback to `image/jpeg` for unrecognised types is retained.

## Cost Logging

The `api_usage_logs` table is unchanged. The logged `model` value changes from `claude-haiku-4-5-20251001` to `gemini-2.0-flash`. Input/output token counts and `cost_usd` are populated from `result.response.usageMetadata`. If `usageMetadata` is absent, token counts default to `0`.

## Error Handling

The API call is wrapped in try/catch. On any error, the action returns `{ error: 'Scan fehlgeschlagen, bitte erneut versuchen' }`. The response parsing (regex JSON extraction, field validation) is unchanged.

## Environment Variable

| Old | New |
|---|---|
| `ANTHROPIC_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` |

Must be set in `.env.local` and in the production environment (Vercel env vars). The old key can be removed from both.

## What Does Not Change

- `ScanResult` interface
- The German JSON extraction prompt
- JSON parsing and field validation logic
- Error messages shown to users
- `ScanLabelButton` component
- `QuickAddSheet` and `WineForm` integration
- `api_usage_logs` table schema
- `feature` log value (`'label_scan'`)
