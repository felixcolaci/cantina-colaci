// Shared offset-pagination helpers for the PowerSync query hooks in
// lib/powersync/queries.ts. Pagination runs against the local SQLite
// mirror, so LIMIT/OFFSET and COUNT(*) are plain SQL rather than a
// server-side concern.

export const PAGE_SIZE = 20

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

export function offsetParams(page: number): [limit: number, offset: number] {
  return [PAGE_SIZE, Math.max(0, page - 1) * PAGE_SIZE]
}

// Escapes SQLite LIKE wildcards ("%", "_") in user input so a literal
// percent sign or underscore filters instead of matching anything, then
// wraps the term for a substring match. Pair with `LIKE ? ESCAPE '\'`.
export function likeTerm(search: string): string {
  const escaped = search.trim().replace(/[\\%_]/g, c => `\\${c}`)
  return `%${escaped}%`
}
