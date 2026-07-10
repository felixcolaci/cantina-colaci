import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()
const mockGetGenerativeModel = vi.fn(() => ({ generateContent: mockGenerateContent }))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function() {
    return {
      getGenerativeModel: mockGetGenerativeModel,
    }
  }),
}))

const mockGetUser = vi.fn()
const mockMembershipMaybeSingle = vi.fn()
const mockUsageInsert = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'api_usage_logs') {
    return { insert: mockUsageInsert }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

import { scanWineLabel } from '../scan-label'

function makeError(status: number) {
  const err = new Error(`status ${status}`) as Error & { status: number }
  err.status = status
  return err
}

function makeSuccessResult(json: Record<string, unknown> = { name: 'Barolo' }) {
  return {
    response: {
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      text: () => JSON.stringify(json),
    },
  }
}

function makeFormData(): FormData {
  const fd = new FormData()
  fd.set('image', new File(['fake-image-bytes'], 'label.jpg', { type: 'image/jpeg' }))
  return fd
}

describe('scanWineLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockUsageInsert.mockResolvedValue({ error: null })
  })

  it('retries the primary model on a transient 503 then succeeds', async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(makeError(503))
      .mockResolvedValueOnce(makeSuccessResult({ name: 'Barolo' }))

    const promise = scanWineLabel(makeFormData())
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.error).toBeUndefined()
    expect(result.name).toBe('Barolo')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash' })
    )
  })

  it('falls back to the fallback model after the primary exhausts retries', async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockResolvedValueOnce(makeSuccessResult({ name: 'Chianti' }))

    const promise = scanWineLabel(makeFormData())
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.error).toBeUndefined()
    expect(result.name).toBe('Chianti')
    expect(mockGenerateContent).toHaveBeenCalledTimes(4)
    expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(4, { model: 'gemini-1.5-flash' })
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-1.5-flash' })
    )
  })

  it('fails fast on a non-retryable error without trying the fallback', async () => {
    mockGenerateContent.mockRejectedValueOnce(makeError(400))

    const result = await scanWineLabel(makeFormData())

    expect(result.error).toBe('Scan fehlgeschlagen, bitte erneut versuchen')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(mockUsageInsert).not.toHaveBeenCalled()
  })

  it('returns the generic error when both the primary and fallback are exhausted', async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))
      .mockRejectedValueOnce(makeError(503))

    const promise = scanWineLabel(makeFormData())
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.error).toBe('Scan fehlgeschlagen, bitte erneut versuchen')
    expect(mockGenerateContent).toHaveBeenCalledTimes(4)
    expect(mockUsageInsert).not.toHaveBeenCalled()
  })
})
