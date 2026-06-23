'use client'

import { useTransition, useState, useRef, useCallback } from 'react'

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false
  const msg = (err as TypeError).message.toLowerCase()
  return (
    msg === 'failed to fetch' ||
    msg === 'load failed' ||
    msg === 'networkerror when attempting to fetch resource'
  )
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

async function withRetry<T extends unknown[]>(
  action: (...args: T) => Promise<void>,
  args: T,
  maxAttempts = 3,
  delayMs = 500,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await action(...args)
      return
    } catch (err) {
      if (isRedirectError(err)) throw err
      if (!isNetworkError(err) || attempt === maxAttempts - 1) throw err
      await new Promise<void>(resolve => setTimeout(resolve, delayMs))
    }
  }
}

export function useServerAction<T extends unknown[]>(action: (...args: T) => Promise<void>) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const actionRef = useRef(action)
  actionRef.current = action

  const run = useCallback((...args: T) => {
    startTransition(async () => {
      setError(null)
      try {
        await withRetry(actionRef.current, args)
      } catch (err) {
        if (isRedirectError(err)) throw err
        if (isNetworkError(err)) {
          setError('Netzwerkfehler – bitte Verbindung prüfen.')
        } else {
          setError('Fehler beim Speichern – bitte nochmal versuchen.')
        }
      }
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { run, isPending, error, clearError }
}
