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

export type OfflineQueueFn = (formData: FormData) => Promise<string>

export function useServerAction<T extends unknown[]>(
  action: (...args: T) => Promise<void>,
  offlineQueue?: OfflineQueueFn,
) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [offlineSaved, setOfflineSaved] = useState(false)
  const actionRef = useRef(action)
  actionRef.current = action

  const run = useCallback((...args: T) => {
    startTransition(async () => {
      setError(null)
      setOfflineSaved(false)

      // If offline and a queue function is provided, queue immediately
      if (offlineQueue && !navigator.onLine && args[0] instanceof FormData) {
        try {
          await offlineQueue(args[0] as FormData)
          setOfflineSaved(true)
          return
        } catch {
          setError('Offline – Daten konnten nicht gespeichert werden.')
          return
        }
      }

      try {
        await withRetry(actionRef.current, args)
      } catch (err) {
        if (isRedirectError(err)) throw err
        if (isNetworkError(err) && offlineQueue && args[0] instanceof FormData) {
          try {
            await offlineQueue(args[0] as FormData)
            setOfflineSaved(true)
            return
          } catch {
            // fall through to error
          }
        }
        if (isNetworkError(err)) {
          setError('Netzwerkfehler – bitte Verbindung prüfen.')
        } else {
          setError('Fehler beim Speichern – bitte nochmal versuchen.')
        }
      }
    })
  }, [offlineQueue])

  const clearError = useCallback(() => setError(null), [])

  return { run, isPending, error, clearError, offlineSaved }
}
