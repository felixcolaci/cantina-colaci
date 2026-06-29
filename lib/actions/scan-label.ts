'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MODEL = 'claude-haiku-4-5-20251001'
const INPUT_COST  = 1 / 1_000_000
const OUTPUT_COST = 5 / 1_000_000

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

  const bytes   = await image.arrayBuffer()
  const base64  = Buffer.from(bytes).toString('base64')
  const mediaType = (
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type)
      ? image.type
      : 'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const client = new Anthropic()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
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
      ],
    }],
  })

  const inputTokens  = message.usage.input_tokens
  const outputTokens = message.usage.output_tokens
  const costUsd = inputTokens * INPUT_COST + outputTokens * OUTPUT_COST

  await admin.from('api_usage_logs').insert({
    family_id:     membership.family_id,
    feature:       'label_scan',
    model:         MODEL,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    cost_usd:      costUsd,
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { error: 'Etikett konnte nicht gelesen werden' }
    const p = JSON.parse(jsonMatch[0])
    const currentYear = new Date().getFullYear()
    return {
      name:         p.name     || undefined,
      producer:     p.producer || undefined,
      vintage:      typeof p.vintage === 'number' && p.vintage > 1900 && p.vintage <= currentYear + 1
                      ? p.vintage : undefined,
      type:         ['red', 'white', 'rosé', 'sparkling'].includes(p.type) ? p.type : undefined,
      country:      p.country      || undefined,
      region:       p.region       || undefined,
      grape_variety: p.grape_variety || undefined,
    }
  } catch {
    return { error: 'Etikett konnte nicht gelesen werden' }
  }
}
