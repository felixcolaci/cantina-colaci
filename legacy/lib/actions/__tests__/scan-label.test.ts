import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NoObjectGeneratedError } from 'ai'

const { mockGenerateText, mockGetAvailableModels } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetAvailableModels: vi.fn(),
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    generateText: mockGenerateText,
    gateway: { getAvailableModels: mockGetAvailableModels },
  }
})

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

// Re-imported fresh per test (see beforeEach) so the module's in-memory
// pricing cache never leaks between tests.
let scanWineLabel: typeof import('../scan-label').scanWineLabel

function makeSuccessResult(
  output: Record<string, unknown> = { name: 'Barolo' },
  opts: { modelId?: string; inputTokens?: number; outputTokens?: number } = {},
) {
  return {
    output,
    response: { modelId: opts.modelId ?? 'google/gemini-2.5-flash' },
    usage: { inputTokens: opts.inputTokens ?? 100, outputTokens: opts.outputTokens ?? 50 },
  }
}

function makeFormData(): FormData {
  const fd = new FormData()
  fd.set('image', new File(['fake-image-bytes'], 'label.jpg', { type: 'image/jpeg' }))
  return fd
}

describe('scanWineLabel', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    ;({ scanWineLabel } = await import('../scan-label'))
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockUsageInsert.mockResolvedValue({ error: null })
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: 'google/gemini-2.5-flash', pricing: { input: '0.0000003', output: '0.0000025' } },
        { id: 'google/gemini-2.5-flash-lite', pricing: { input: '0.0000001', output: '0.0000004' } },
      ],
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the scanned fields and logs usage/cost for the model that actually served the request', async () => {
    mockGenerateText.mockResolvedValue(makeSuccessResult({ name: 'Barolo', producer: 'Marchesi' }))

    const result = await scanWineLabel(makeFormData())

    expect(result.error).toBeUndefined()
    expect(result.name).toBe('Barolo')
    expect(result.producer).toBe('Marchesi')
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        family_id: 'fam-1',
        feature: 'label_scan',
        model: 'google/gemini-2.5-flash',
        input_tokens: 100,
        output_tokens: 50,
        cost_usd: 100 * 0.0000003 + 50 * 0.0000025,
      })
    )
  })

  it('logs the fallback model when the gateway actually served the request with it', async () => {
    mockGenerateText.mockResolvedValue(
      makeSuccessResult({ name: 'Chianti' }, { modelId: 'google/gemini-2.5-flash-lite' })
    )

    const result = await scanWineLabel(makeFormData())

    expect(result.name).toBe('Chianti')
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'google/gemini-2.5-flash-lite' })
    )
  })

  it('passes the Google key as BYOK and the fallback model to the gateway', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-key')
    mockGenerateText.mockResolvedValue(makeSuccessResult())

    await scanWineLabel(makeFormData())

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-2.5-flash',
        providerOptions: {
          gateway: {
            models: ['google/gemini-2.5-flash-lite'],
            byok: { google: [{ apiKey: 'test-key' }] },
          },
        },
      })
    )
  })

  it('omits byok when no Google key is configured', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
    mockGenerateText.mockResolvedValue(makeSuccessResult())

    await scanWineLabel(makeFormData())

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.providerOptions.gateway.byok).toBeUndefined()
  })

  it('drops an out-of-range vintage instead of failing the whole scan', async () => {
    mockGenerateText.mockResolvedValue(makeSuccessResult({ name: 'Barolo', vintage: 1850 }))

    const result = await scanWineLabel(makeFormData())

    expect(result.name).toBe('Barolo')
    expect(result.vintage).toBeUndefined()
  })

  it('returns the generic error when the gateway call fails, without logging usage', async () => {
    mockGenerateText.mockRejectedValue(new Error('upstream failure'))

    const result = await scanWineLabel(makeFormData())

    expect(result.error).toBe('Scan fehlgeschlagen, bitte erneut versuchen')
    expect(mockUsageInsert).not.toHaveBeenCalled()
  })

  it('returns the "could not read label" error when the model never produces a valid object', async () => {
    mockGenerateText.mockRejectedValue(
      new NoObjectGeneratedError({
        message: 'no object generated',
        text: '',
        response: { id: '1', timestamp: new Date(), modelId: 'x' },
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
        },
        finishReason: 'stop',
      })
    )

    const result = await scanWineLabel(makeFormData())

    expect(result.error).toBe('Etikett konnte nicht gelesen werden')
    expect(mockUsageInsert).not.toHaveBeenCalled()
  })

  it('degrades cost to 0 (instead of throwing) when the pricing catalog is unavailable', async () => {
    mockGetAvailableModels.mockRejectedValue(new Error('network error'))
    mockGenerateText.mockResolvedValue(makeSuccessResult())

    const result = await scanWineLabel(makeFormData())

    expect(result.error).toBeUndefined()
    expect(mockUsageInsert).toHaveBeenCalledWith(expect.objectContaining({ cost_usd: 0 }))
  })
})
