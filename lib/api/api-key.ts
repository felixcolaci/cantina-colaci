/**
 * Validates a POST /api/v1/api-keys body. Mirrors legacy's generateApiKey
 * action (legacy/lib/actions/api-keys.ts): name is the only caller-supplied
 * field, required and non-blank.
 */
export function parseApiKeyInsert(body: unknown): { name: string } | null {
  if (!body || typeof body !== 'object') return null
  const name = (body as Record<string, unknown>).name
  if (typeof name !== 'string' || !name.trim()) return null
  return { name: name.trim().slice(0, 100) }
}
