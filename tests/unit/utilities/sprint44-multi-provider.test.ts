/**
 * Sprint 44 — Multi-Provider AI + Cache Invalidation Tests
 *
 * Tests:
 *   1. resolveImageProvider() — provider selection logic
 *   2. revalidateAfterMutation() — cache invalidation calls
 *   3. CONTENT_MUTATION_TOOLS — mapping correctness
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock next/cache before importing modules that use it
// ---------------------------------------------------------------------------

const mockRevalidatePath = vi.fn()
const mockRevalidateTag = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  unstable_cache: vi.fn((fn: any) => fn),
}))

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    languageModel: vi.fn(),
    imageModel: vi.fn(),
  })),
}))

vi.mock('ai', () => ({
  tool: vi.fn((def: any) => def),
  jsonSchema: vi.fn((s: any) => s),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
  },
}))

vi.mock('path', () => ({
  default: {
    resolve: vi.fn((...parts: string[]) => parts.join('/')),
  },
}))

// ---------------------------------------------------------------------------
// Import modules under test
// ---------------------------------------------------------------------------

import {
  resolveImageProvider,
  type TenantAiConfig,
  type ResolvedImageProvider,
} from '../../../src/utilities/ai-gateway'

import { revalidateAfterMutation } from '../../../src/utilities/revalidateContent'

// ---------------------------------------------------------------------------
// resolveImageProvider() Tests
// ---------------------------------------------------------------------------

describe('resolveImageProvider', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when no keys are configured', () => {
    const result = resolveImageProvider({})
    expect(result).toBeNull()
  })

  it('returns openai when preferred and key exists', () => {
    const config: TenantAiConfig = {
      preferredImageProvider: 'openai',
      openaiApiKey: 'sk-test-123',
    }
    const result = resolveImageProvider(config)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('openai')
    expect(result!.apiKey).toBe('sk-test-123')
  })

  it('returns google when preferred and key exists', () => {
    const config: TenantAiConfig = {
      preferredImageProvider: 'google',
      googleAiApiKey: 'AIza-test',
    }
    const result = resolveImageProvider(config)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('google')
    expect(result!.apiKey).toBe('AIza-test')
  })

  it('returns cloudflare when preferred and both token + accountId exist', () => {
    const config: TenantAiConfig = {
      preferredImageProvider: 'cloudflare',
      cloudflareAiToken: 'cf-token',
      cloudflareAccountId: 'cf-account-123',
    }
    const result = resolveImageProvider(config)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('cloudflare')
    expect(result!.apiKey).toBe('cf-token')
    expect(result!.accountId).toBe('cf-account-123')
  })

  it('returns null for cloudflare when token exists but accountId missing', () => {
    const config: TenantAiConfig = {
      preferredImageProvider: 'cloudflare',
      cloudflareAiToken: 'cf-token',
    }
    const result = resolveImageProvider(config)
    // Should fall through to auto, which also finds nothing
    expect(result).toBeNull()
  })

  it('falls back to auto when preferred provider key is missing', () => {
    const config: TenantAiConfig = {
      preferredImageProvider: 'openai',
      // No openaiApiKey — should fall through to auto
      openrouterApiKey: 'or-key',
    }
    const result = resolveImageProvider(config)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('openrouter')
    expect(result!.apiKey).toBe('or-key')
  })

  it('auto mode tries openrouter before openai', () => {
    const config: TenantAiConfig = {
      preferredImageProvider: 'auto',
      openrouterApiKey: 'or-key',
      openaiApiKey: 'sk-test',
    }
    const result = resolveImageProvider(config)
    expect(result!.provider).toBe('openrouter')
  })

  it('uses env var fallback for openrouter', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'env-or-key')
    const result = resolveImageProvider({})
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('openrouter')
    expect(result!.apiKey).toBe('env-or-key')
  })

  it('uses env var fallback for openai', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-openai-key')
    const result = resolveImageProvider({})
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('openai')
    expect(result!.apiKey).toBe('env-openai-key')
  })

  it('uses env var fallback for google', () => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'env-google-key')
    const result = resolveImageProvider({})
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('google')
    expect(result!.apiKey).toBe('env-google-key')
  })

  it('uses env var fallback for cloudflare', () => {
    vi.stubEnv('CLOUDFLARE_AI_TOKEN', 'env-cf-token')
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'env-cf-account')
    const result = resolveImageProvider({})
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('cloudflare')
    expect(result!.apiKey).toBe('env-cf-token')
    expect(result!.accountId).toBe('env-cf-account')
  })

  it('tenant key takes priority over env var', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key')
    const config: TenantAiConfig = {
      preferredImageProvider: 'openai',
      openaiApiKey: 'tenant-key',
    }
    const result = resolveImageProvider(config)
    expect(result!.apiKey).toBe('tenant-key')
  })

  it('handles undefined config gracefully', () => {
    const result = resolveImageProvider(undefined)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// revalidateAfterMutation() Tests
// ---------------------------------------------------------------------------

describe('revalidateAfterMutation', () => {
  beforeEach(() => {
    mockRevalidatePath.mockClear()
    mockRevalidateTag.mockClear()
  })

  it('revalidates tenant tags when tenantId provided', () => {
    revalidateAfterMutation({ collection: 'media', tenantId: 42 })

    expect(mockRevalidateTag).toHaveBeenCalledWith('tenant_site-settings_42', 'default')
    expect(mockRevalidateTag).toHaveBeenCalledWith('tenant_header_42', 'default')
    expect(mockRevalidateTag).toHaveBeenCalledWith('tenant_footer_42', 'default')
  })

  it('revalidates page path for pages collection', () => {
    revalidateAfterMutation({ collection: 'pages', tenantId: 1, slug: 'about' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/about')
  })

  it('revalidates home page as root path', () => {
    revalidateAfterMutation({ collection: 'pages', tenantId: 1, slug: 'home' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('revalidates post path + listing for posts collection', () => {
    revalidateAfterMutation({ collection: 'posts', tenantId: 1, slug: 'hello-world' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/hello-world')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts')
  })

  it('revalidates product path + listing for products collection', () => {
    revalidateAfterMutation({ collection: 'products', tenantId: 1, slug: 'widget' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/products/widget')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/products')
  })

  it('revalidates event path + listing for events collection', () => {
    revalidateAfterMutation({ collection: 'events', tenantId: 1, slug: 'summer-fair' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/summer-fair')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
  })

  it('does not revalidate paths when no slug provided', () => {
    revalidateAfterMutation({ collection: 'pages', tenantId: 1 })
    // Should still revalidate tags
    expect(mockRevalidateTag).toHaveBeenCalled()
    // But not path (no slug)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('does not revalidate tags when no tenantId', () => {
    revalidateAfterMutation({ collection: 'pages', slug: 'about' })
    expect(mockRevalidateTag).not.toHaveBeenCalled()
    // Still revalidates path
    expect(mockRevalidatePath).toHaveBeenCalledWith('/about')
  })

  it('handles unknown collections gracefully', () => {
    revalidateAfterMutation({ collection: 'custom-stuff', tenantId: 5 })
    // Only tags, no path
    expect(mockRevalidateTag).toHaveBeenCalledTimes(3)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('silently catches errors (works outside Next.js)', () => {
    mockRevalidateTag.mockImplementation(() => { throw new Error('Not in Next.js') })
    // Should not throw
    expect(() => revalidateAfterMutation({ collection: 'pages', tenantId: 1, slug: 'test' })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// TenantAiConfig type shape tests
// ---------------------------------------------------------------------------

describe('TenantAiConfig', () => {
  it('supports all provider key fields', () => {
    const config: TenantAiConfig = {
      anthropicApiKey: 'sk-ant-test',
      openrouterApiKey: 'or-test',
      openaiApiKey: 'sk-test',
      googleAiApiKey: 'AIza-test',
      cloudflareAccountId: 'cf-acct',
      cloudflareAiToken: 'cf-token',
      preferredImageProvider: 'auto',
    }
    expect(config.anthropicApiKey).toBe('sk-ant-test')
    expect(config.preferredImageProvider).toBe('auto')
  })

  it('all fields are optional', () => {
    const config: TenantAiConfig = {}
    expect(config.openaiApiKey).toBeUndefined()
  })

  it('preferredImageProvider accepts all valid values', () => {
    const values: TenantAiConfig['preferredImageProvider'][] = [
      'auto', 'openai', 'google', 'openrouter', 'cloudflare',
    ]
    for (const v of values) {
      const config: TenantAiConfig = { preferredImageProvider: v }
      expect(config.preferredImageProvider).toBe(v)
    }
  })
})
