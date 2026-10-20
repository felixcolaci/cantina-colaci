'use server'

import { generateText, Output, NoObjectGeneratedError, gateway } from 'ai'
import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Gateway model IDs ("provider/model"), not raw Google model names -- see
// https://ai-gateway.vercel.sh/v1/models for the live catalog. The fallback
// is tried only if every provider for the primary model fails.
const MODEL          = process.env.AI_GATEWAY_MODEL ?? 'google/gemini-2.5-flash'
const FALLBACK_MODEL = process.env.AI_GATEWAY_FALLBACK_MODEL ?? 'google/gemini-2.5-flash-lite'

// How long to reuse a fetched model-pricing snapshot before refetching.
// Pricing doesn't change often enough to justify a lookup per scan.
const PRICING_TTL_MS = 60 * 60 * 1000

export interface ScanResult {
  name?: string
  producer?: string
  vintage?: number | null
  type?: 'red' | 'white' | 'rosé' | 'sparkling'
  country?: string
  region?: string
  grape_variety?: string
}

const ScanResultSchema = z.object({
  name: z.string().describe('Weinname, z.B. Barolo, Chianti Classico').optional(),
  producer: z.string().describe('Produzent / Weingut').optional(),
  vintage: z.number().describe('Jahrgang als 4-stellige Zahl').optional(),
  type: z.enum(['red', 'white', 'rosé', 'sparkling']).optional(),
  country: z.string().describe('Land auf Englisch, z.B. Italy, France, Germany').optional(),
  region: z.string().describe('Region, z.B. Toscana, Bordeaux, Rheingau').optional(),
  grape_variety: z.string().describe('Rebsorte(n), z.B. Sangiovese, Cabernet Sauvignon').optional(),
})

type ModelPricing = { input: number; output: number }

let pricingCache: { expiresAt: number; byModelId: Map<string, GatewayLanguageModelEntry['pricing']> } | null = null

async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
  const now = Date.now()
  if (!pricingCache || pricingCache.expiresAt < now) {
    try {
      const { models } = await gateway.getAvailableModels()
      pricingCache = {
        expiresAt: now + PRICING_TTL_MS,
        byModelId: new Map(models.map(m => [m.id, m.pricing])),
      }
    } catch (err) {
      console.error('[scan-label] failed to fetch gateway model pricing:', err)
      return null
    }
  }
  const pricing = pricingCache.byModelId.get(modelId)
  if (!pricing) return null
  return { input: Number(pricing.input), output: Number(pricing.output) }
}

async function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): Promise<number> {
  const pricing = await getModelPricing(modelId)
  if (!pricing) return 0
  return inputTokens * pricing.input + outputTokens * pricing.output
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

  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const gatewayOptions: { models: string[]; byok?: Record<string, Array<{ apiKey: string }>> } = {
    models: [FALLBACK_MODEL],
  }
  // BYOK keeps us on our own Google AI Studio quota/free tier instead of
  // metered AI Gateway credits, while still getting gateway fallback/logs.
  if (googleApiKey) {
    gatewayOptions.byok = { google: [{ apiKey: googleApiKey }] }
  }

  let result
  try {
    result = await generateText({
      model: MODEL,
      providerOptions: { gateway: gatewayOptions },
      output: Output.object({ schema: ScanResultSchema }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: base64, mediaType: mimeType },
            {
              type: 'text',
              text: 'Analysiere dieses Weinetikett und extrahiere Name, Produzent, Jahrgang, Weintyp, Land, Region und Rebsorte. Lasse Felder weg, die du auf dem Etikett nicht eindeutig erkennen kannst.',
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('[scan-label] AI Gateway error:', err)
    if (NoObjectGeneratedError.isInstance(err)) return { error: 'Etikett konnte nicht gelesen werden' }
    return { error: 'Scan fehlgeschlagen, bitte erneut versuchen' }
  }

  const usedModel = result.response.modelId
  const inputTokens = result.usage.inputTokens ?? 0
  const outputTokens = result.usage.outputTokens ?? 0
  const costUsd = await estimateCostUsd(usedModel, inputTokens, outputTokens)

  const { error: logError } = await admin.from('api_usage_logs').insert({
    family_id:     membership.family_id,
    feature:       'label_scan',
    model:         usedModel,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    cost_usd:      costUsd,
  })
  if (logError) console.error('[scan-label] usage log failed:', logError.message)

  const p = result.output
  const currentYear = new Date().getFullYear()
  return {
    name:          p.name     || undefined,
    producer:      p.producer || undefined,
    vintage:       typeof p.vintage === 'number' && p.vintage > 1900 && p.vintage <= currentYear + 1
                     ? p.vintage : undefined,
    type:          p.type,
    country:       p.country       || undefined,
    region:        p.region        || undefined,
    grape_variety: p.grape_variety || undefined,
  }
}
