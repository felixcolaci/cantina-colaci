import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useServerAction } from '@/lib/hooks/use-server-action'

describe('useServerAction', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls the action and leaves error null on success', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it('sets generic error message for non-network errors', async () => {
    const action = vi.fn().mockRejectedValue(new Error('DB constraint violated'))
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(result.current.error).toBe('Fehler beim Speichern – bitte nochmal versuchen.')
    expect(action).toHaveBeenCalledTimes(1) // no retries for non-network errors
  })

  it('retries network errors 3 times then sets network error message', async () => {
    const networkError = new TypeError('Failed to fetch')
    const action = vi.fn().mockRejectedValue(networkError)
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(3)
    expect(result.current.error).toBe('Netzwerkfehler – bitte Verbindung prüfen.')
  })

  it('succeeds on second attempt after initial network failure', async () => {
    const networkError = new TypeError('Failed to fetch')
    const action = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })

  it('does not retry non-TypeError errors even with "fetch" in message', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fetch quota exceeded'))
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBe('Fehler beim Speichern – bitte nochmal versuchen.')
  })

  it('clearError resets error to null', async () => {
    const action = vi.fn().mockRejectedValue(new Error('oops'))
    const { result } = renderHook(() => useServerAction(action))

    act(() => { result.current.run() })
    await act(() => vi.runAllTimersAsync())
    expect(result.current.error).not.toBeNull()

    act(() => { result.current.clearError() })
    expect(result.current.error).toBeNull()
  })

  it('passes arguments to the action', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useServerAction(action))
    const fd = new FormData()
    fd.set('name', 'Barolo')

    act(() => { result.current.run(fd) })
    await act(() => vi.runAllTimersAsync())

    expect(action).toHaveBeenCalledWith(fd)
  })
})
