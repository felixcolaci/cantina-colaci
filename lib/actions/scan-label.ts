'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
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
