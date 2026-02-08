import { headers } from 'next/headers'
import { BusinessAgentFactory } from '@/services/BusinessAgent'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

interface TranslationContext {
  userLanguage: string
  shouldTranslate: boolean
  tenantId?: string
}

export async function getTranslationContext(): Promise<TranslationContext> {
  const headersList = await headers()
  const userLanguage = headersList.get('x-user-language') || 'en'
  const shouldTranslate = headersList.get('x-auto-translate') === 'true'

  return {
    userLanguage,
    shouldTranslate,
  }
}

export async function autoTranslateContent<T extends string>(
  content: T,
  tenantId: string,
  translationContext?: TranslationContext
): Promise<T> {
  const context = translationContext || await getTranslationContext()

  if (!context.shouldTranslate || context.userLanguage === 'en') {
    return content
  }

  try {
    // Get tenant for business context
    const payload = await getPayload({ config: configPromise })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId
    })

    if (!tenant) {
      console.warn(`[AutoTranslation] Tenant not found: ${tenantId}`)
      return content
    }

    // Create BusinessAgent for this tenant
    const businessAgent = BusinessAgentFactory.createForTenant(tenant)

    // Use BusinessAgent to translate content
    const translatedContent = await businessAgent.translateSiteContent(content, context.userLanguage)

    console.log(`[AutoTranslation] Translated content for tenant ${tenantId} to ${context.userLanguage}`)
    return translatedContent as T

  } catch (error) {
    console.error('[AutoTranslation] Translation failed:', error)
    return content // Return original content on error
  }
}

export async function autoTranslatePage(
  pageData: unknown,
  tenantId: string
): Promise<unknown> {
  const context = await getTranslationContext()

  if (!context.shouldTranslate) {
    return pageData
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId
    })

    if (!tenant) return pageData

    const businessAgent = BusinessAgentFactory.createForTenant(tenant)

    // Let BusinessAgent handle the full page translation
    return await businessAgent.autoTranslatePage(pageData, context.userLanguage)

  } catch (error) {
    console.error('[AutoTranslation] Page translation failed:', error)
    return pageData
  }
}

// Utility for translating product catalogs
export async function autoTranslateProducts(
  products: unknown[],
  tenantId: string
): Promise<unknown[]> {
  const context = await getTranslationContext()

  if (!context.shouldTranslate || !products.length) {
    return products
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId
    })

    if (!tenant) return products

    const businessAgent = BusinessAgentFactory.createForTenant(tenant)

    return await businessAgent.translateProductCatalog(products, context.userLanguage)

  } catch (error) {
    console.error('[AutoTranslation] Product translation failed:', error)
    return products
  }
}

// Helper for simple text translation
export async function translateText(
  text: string,
  tenantId: string,
  targetLanguage?: string
): Promise<string> {
  const context = await getTranslationContext()
  const language = targetLanguage || context.userLanguage

  if (language === 'en' || !text) {
    return text
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId
    })

    if (!tenant) return text

    const businessAgent = BusinessAgentFactory.createForTenant(tenant)

    return await businessAgent.translateWithBusinessContext(text, language)

  } catch (error) {
    console.error('[AutoTranslation] Text translation failed:', error)
    return text
  }
}
