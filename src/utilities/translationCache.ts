import { BusinessAgentFactory } from '@/services/BusinessAgent'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

interface CacheEntry {
  translatedContent: unknown
  sourceHash: string
  language: string
  tenantId: string
  createdAt: Date
  lastAccessed: Date
}

interface CacheKey {
  contentType: 'page' | 'product' | 'post' | 'content'
  contentId: string
  language: string
  tenantId: string
}

// In-memory cache - in production, you'd use Redis or similar
const translationCache = new Map<string, CacheEntry>()

// Generate cache key
function generateCacheKey(key: CacheKey): string {
  return `${key.contentType}:${key.contentId}:${key.language}:${key.tenantId}`
}

// Generate hash of content for change detection
function generateContentHash(content: unknown): string {
  const contentString = JSON.stringify(content, Object.keys(content as Record<string, unknown>).sort())
  let hash = 0
  for (let i = 0; i < contentString.length; i++) {
    const char = contentString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(16)
}

// Cache cleanup - remove entries older than 24 hours
function cleanupCache(): void {
  const now = new Date()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  for (const [key, entry] of translationCache.entries()) {
    if (now.getTime() - entry.lastAccessed.getTime() > maxAge) {
      translationCache.delete(key)
      console.log(`[TranslationCache] Cleaned up stale entry: ${key}`)
    }
  }
}

// Periodic cleanup (run every hour)
setInterval(cleanupCache, 60 * 60 * 1000)

export async function getCachedTranslation<T>(
  content: T,
  cacheKey: CacheKey
): Promise<T | null> {
  const key = generateCacheKey(cacheKey)
  const cached = translationCache.get(key)

  if (!cached) {
    return null
  }

  // Check if content has changed
  const currentHash = generateContentHash(content)
  if (cached.sourceHash !== currentHash) {
    // Content changed, invalidate cache
    translationCache.delete(key)
    console.log(`[TranslationCache] Content changed, invalidated: ${key}`)
    return null
  }

  // Update last accessed time
  cached.lastAccessed = new Date()
  translationCache.set(key, cached)

  console.log(`[TranslationCache] Cache hit: ${key}`)
  return cached.translatedContent as T
}

export async function setCachedTranslation<T>(
  originalContent: T,
  translatedContent: T,
  cacheKey: CacheKey
): Promise<void> {
  const key = generateCacheKey(cacheKey)
  const sourceHash = generateContentHash(originalContent)

  const entry: CacheEntry = {
    translatedContent,
    sourceHash,
    language: cacheKey.language,
    tenantId: cacheKey.tenantId,
    createdAt: new Date(),
    lastAccessed: new Date()
  }

  translationCache.set(key, entry)
  console.log(`[TranslationCache] Cached translation: ${key}`)
}

export async function smartTranslateContent<T extends string>(
  content: T,
  cacheKey: CacheKey
): Promise<T> {
  // Check cache first
  const cached = await getCachedTranslation(content, cacheKey)
  if (cached) {
    return cached
  }

  // Not in cache or content changed, translate now
  try {
    const payload = await getPayload({ config: configPromise })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: cacheKey.tenantId
    })

    if (!tenant) {
      console.warn(`[SmartTranslation] Tenant not found: ${cacheKey.tenantId}`)
      return content
    }

    const businessAgent = BusinessAgentFactory.createForTenant(tenant)
    const translatedContent = await businessAgent.translateSiteContent(content, cacheKey.language)

    // Cache the result
    await setCachedTranslation(content, translatedContent as T, cacheKey)

    console.log(`[SmartTranslation] Translated and cached: ${generateCacheKey(cacheKey)}`)
    return translatedContent as T

  } catch (error) {
    console.error(`[SmartTranslation] Translation failed:`, error)
    return content
  }
}

// Smart page translation with caching
export async function smartTranslatePage(
  pageData: unknown,
  pageId: string,
  tenantId: string,
  targetLanguage: string
): Promise<unknown> {
  if (targetLanguage === 'en') {
    return pageData
  }

  const cacheKey: CacheKey = {
    contentType: 'page',
    contentId: pageId,
    language: targetLanguage,
    tenantId
  }

  // Convert to string for translation, then parse back
  const pageDataString = JSON.stringify(pageData)
  const translatedString = await smartTranslateContent(pageDataString, cacheKey)
  
  try {
    return JSON.parse(translatedString)
  } catch {
    return pageData // Return original if parsing fails
  }
}

// Smart product translation with caching
export async function smartTranslateProducts(
  products: unknown[],
  tenantId: string,
  targetLanguage: string
): Promise<unknown[]> {
  if (targetLanguage === 'en' || !products.length) {
    return products
  }

  const translatedProducts = []

  for (const product of products) {
    const cacheKey: CacheKey = {
      contentType: 'product',
      contentId: (product as { id: string | number }).id.toString(),
      language: targetLanguage,
      tenantId
    }

    // Convert to string for translation, then parse back
    const productString = JSON.stringify(product)
    const translatedString = await smartTranslateContent(productString, cacheKey)
    
    try {
      const translatedProduct = JSON.parse(translatedString)
      translatedProducts.push(translatedProduct)
    } catch {
      translatedProducts.push(product) // Use original if parsing fails
    }
  }

  return translatedProducts
}

// Smart text translation with caching
export async function smartTranslateText(
  text: string,
  textId: string, // Unique identifier for this text
  tenantId: string,
  targetLanguage: string
): Promise<string> {
  if (targetLanguage === 'en' || !text) {
    return text
  }

  const cacheKey: CacheKey = {
    contentType: 'content',
    contentId: textId,
    language: targetLanguage,
    tenantId
  }

  return await smartTranslateContent(text, cacheKey)
}

// Cache statistics
export function getCacheStats(): {
  totalEntries: number
  languages: string[]
  tenants: string[]
  oldestEntry: Date | null
  newestEntry: Date | null
} {
  const languages = new Set<string>()
  const tenants = new Set<string>()
  let oldestEntry: Date | null = null
  let newestEntry: Date | null = null

  for (const entry of translationCache.values()) {
    languages.add(entry.language)
    tenants.add(entry.tenantId)

    if (!oldestEntry || entry.createdAt < oldestEntry) {
      oldestEntry = entry.createdAt
    }
    if (!newestEntry || entry.createdAt > newestEntry) {
      newestEntry = entry.createdAt
    }
  }

  return {
    totalEntries: translationCache.size,
    languages: Array.from(languages),
    tenants: Array.from(tenants),
    oldestEntry,
    newestEntry
  }
}

// Manual cache invalidation
export function invalidateCache(pattern?: string): number {
  if (!pattern) {
    const count = translationCache.size
    translationCache.clear()
    console.log(`[TranslationCache] Cleared all ${count} entries`)
    return count
  }

  let deletedCount = 0
  for (const key of translationCache.keys()) {
    if (key.includes(pattern)) {
      translationCache.delete(key)
      deletedCount++
    }
  }

  console.log(`[TranslationCache] Invalidated ${deletedCount} entries matching: ${pattern}`)
  return deletedCount
}
