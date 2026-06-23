import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/server'

export function createMcpServer(familyId: string): McpServer {
  const server = new McpServer({
    name: 'cantina-colaci',
    version: '1.0.0',
  })

  server.tool(
    'get_cellar_wines',
    'Returns all wines currently in stock in the family cellar. Use this to recommend wine pairings from the actual collection.',
    {},
    async () => {
      const supabase = createAdminClient()

      const { data: cellar } = await supabase
        .from('cellars')
        .select('id')
        .eq('family_id', familyId)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!cellar) {
        return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] }
      }

      const { data: wines } = await supabase
        .from('wines')
        .select(`
          name, producer, vintage, type, region, country, grape_variety, notes,
          cellar_entries!inner(quantity, status, storage_locations(name))
        `)
        .eq('cellar_id', cellar.id)
        .eq('cellar_entries.status', 'in_stock')
        .gt('cellar_entries.quantity', 0)
        .order('name')

      const result = (wines ?? []).map(wine => {
        const entries = wine.cellar_entries as any[]
        const totalQuantity = entries.reduce((sum: number, e: any) => sum + e.quantity, 0)
        const location = entries[0]?.storage_locations?.name ?? null

        return {
          name: wine.name,
          producer: wine.producer,
          vintage: wine.vintage,
          type: wine.type,
          region: wine.region,
          country: wine.country,
          grape_variety: wine.grape_variety,
          notes: wine.notes,
          quantity: totalQuantity,
          storage_location: location,
        }
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  return server
}
