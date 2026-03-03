/**
 * autoTranslation — Unit Tests
 *
 * Tests the early-return (shouldTranslate=false, language=en) paths and the
 * BusinessAgent delegation paths. Avoids real AI calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

const {
  mockHeaders,
  mockTranslateSiteContent,
  mockAutoTranslatePage,
  mockTranslateProductCatalog,
  mockTranslateWithBusinessContext,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockTranslateSiteContent: vi.fn(),
  mockAutoTranslatePage: vi.fn(),
  mockTranslateProductCatalog: vi.fn(),
  mockTranslateWithBusinessContext: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: mockHeaders }))

vi.mock('@/services/BusinessAgent', () => ({
  BusinessAgentFactory: {
    createForTenant: vi.fn(() => ({
      translateSiteContent: mockTranslateSiteContent,
      autoTranslatePage: mockAutoTranslatePage,
      translateProductCatalog: mockTranslateProductCatalog,
      translateWithBusinessContext: mockTranslateWithBusinessContext,
    })),
  },
}))

import {
  autoTranslateContent,
  autoTranslatePage,
  autoTranslateProducts,
  translateText,
} from '@/utilities/autoTranslation'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeHeadersList(language = 'en', shouldTranslate = false) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'x-user-language') return language
      if (key === 'x-auto-translate') return shouldTranslate ? 'true' : null
      return null
    }),
  }
}

function makePayload(tenant: unknown) {
  return { findByID: vi.fn().mockResolvedValue(tenant) } as any
}

const TENANT = { id: '1', name: 'Acme' }

// ── autoTranslateContent ──────────────────────────────────────────────────────

describe('autoTranslateContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(makeHeadersList('en', false))
  })

  it('returns content unchanged when shouldTranslate=false (via headers)', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', false))
    const result = await autoTranslateContent('Hello world', '1')
    expect(result).toBe('Hello world')
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  it('returns content unchanged when language is "en"', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('en', true))
    const result = await autoTranslateContent('Hello world', '1')
    expect(result).toBe('Hello world')
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  it('calls BusinessAgent.translateSiteContent and returns result', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockTranslateSiteContent.mockResolvedValue('Bonjour monde')
    const result = await autoTranslateContent('Hello world', '1')
    expect(result).toBe('Bonjour monde')
    expect(mockTranslateSiteContent).toHaveBeenCalledWith('Hello world', 'fr')
  })

  it('returns original content when tenant not found', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(null))
    const result = await autoTranslateContent('Hello', '99')
    expect(result).toBe('Hello')
  })

  it('returns original content when BusinessAgent throws', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockTranslateSiteContent.mockRejectedValue(new Error('AI unavailable'))
    const result = await autoTranslateContent('Hello', '1')
    expect(result).toBe('Hello')
  })

  it('accepts explicit translationContext bypassing header read', async () => {
    const ctx = { userLanguage: 'es', shouldTranslate: true }
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockTranslateSiteContent.mockResolvedValue('Hola')
    const result = await autoTranslateContent('Hello', '1', ctx)
    expect(result).toBe('Hola')
    // headers should not have been called
    expect(mockHeaders).not.toHaveBeenCalled()
  })
})

// ── autoTranslatePage ─────────────────────────────────────────────────────────

describe('autoTranslatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns pageData unchanged when shouldTranslate=false', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', false))
    const data = { title: 'Home' }
    const result = await autoTranslatePage(data, '1')
    expect(result).toEqual(data)
  })

  it('delegates to businessAgent.autoTranslatePage when translate enabled', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockAutoTranslatePage.mockResolvedValue({ title: 'Accueil' })
    const result = await autoTranslatePage({ title: 'Home' }, '1')
    expect(result).toEqual({ title: 'Accueil' })
  })

  it('returns pageData when businessAgent throws', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockAutoTranslatePage.mockRejectedValue(new Error('fail'))
    const data = { title: 'Home' }
    const result = await autoTranslatePage(data, '1')
    expect(result).toEqual(data)
  })
})

// ── autoTranslateProducts ─────────────────────────────────────────────────────

describe('autoTranslateProducts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns products unchanged when shouldTranslate=false', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', false))
    const products = [{ name: 'Widget' }]
    const result = await autoTranslateProducts(products, '1')
    expect(result).toEqual(products)
  })

  it('returns products unchanged when products array is empty', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    const result = await autoTranslateProducts([], '1')
    expect(result).toEqual([])
    expect(mockGetPayload).not.toHaveBeenCalled()
  })

  it('delegates to businessAgent.translateProductCatalog', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('de', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    const translated = [{ name: 'Widget DE' }]
    mockTranslateProductCatalog.mockResolvedValue(translated)
    const result = await autoTranslateProducts([{ name: 'Widget' }], '1')
    expect(result).toEqual(translated)
  })
})

// ── translateText ─────────────────────────────────────────────────────────────

describe('translateText', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns text unchanged when language is "en"', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('en', true))
    const result = await translateText('Hello', '1')
    expect(result).toBe('Hello')
  })

  it('returns empty string unchanged', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    const result = await translateText('', '1')
    expect(result).toBe('')
  })

  it('uses explicit targetLanguage over header language', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockTranslateWithBusinessContext.mockResolvedValue('Hola')
    await translateText('Hello', '1', 'es')
    expect(mockTranslateWithBusinessContext).toHaveBeenCalledWith('Hello', 'es')
  })

  it('delegates to businessAgent.translateWithBusinessContext', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockTranslateWithBusinessContext.mockResolvedValue('Bonjour')
    const result = await translateText('Hello', '1')
    expect(result).toBe('Bonjour')
  })

  it('returns original text when businessAgent throws', async () => {
    mockHeaders.mockResolvedValue(makeHeadersList('fr', true))
    mockGetPayload.mockResolvedValue(makePayload(TENANT))
    mockTranslateWithBusinessContext.mockRejectedValue(new Error('fail'))
    const result = await translateText('Hello', '1')
    expect(result).toBe('Hello')
  })
})
