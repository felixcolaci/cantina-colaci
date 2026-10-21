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

/**
 * Generic write, used by the PowerSync upload connector (lib/powersync/connector.ts)
 * to drain the local CRUD queue -- not just plain CRUD UI actions. Every /api/v1/*
 * write route it targets must do its own requireApiUser() + ownership check, same
 * as every existing Server Action (see lib/api/auth.ts).
 */
export async function apiMutate<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T | undefined> {
  const headers = await authHeaders()
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const responseBody = await res.json().catch(() => null)
    throw new ApiError(responseBody?.error ?? res.statusText, res.status)
  }
  if (res.status === 204) return undefined
  return res.json()
}

/**
 * Multipart upload (e.g. wine photos) -- a plain direct network call, not
 * drained through the PowerSync CRUD queue like apiMutate's callers. No
 * Content-Type header: fetch sets the multipart boundary itself from the
 * FormData body, same as every other multipart upload in the browser.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.error ?? res.statusText, res.status)
  }
  return res.json()
}
