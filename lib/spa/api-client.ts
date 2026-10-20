import { createClient } from '@/lib/supabase/client'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new ApiError('Not authenticated', 401)
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { headers: await authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.error ?? res.statusText, res.status)
  }
  return res.json()
}
