/**
 * Business Agent factory - creates tenant-scoped agents for translation and business logic.
 * Stub implementation: translation and agent features can be extended later.
 */
import type { Tenant } from '@/payload-types'

export interface BusinessAgent {
  translateSiteContent(content: string, targetLanguage: string): Promise<string>
  autoTranslatePage(pageData: unknown, userLanguage: string): Promise<unknown>
  translateProductCatalog(products: unknown[], userLanguage: string): Promise<unknown[]>
  translateWithBusinessContext(text: string, language: string): Promise<string>
}

class BusinessAgentImpl implements BusinessAgent {
  constructor(private tenant: Tenant) {}

  async translateSiteContent(content: string, _targetLanguage: string): Promise<string> {
    return content
  }

  async autoTranslatePage(pageData: unknown, _userLanguage: string): Promise<unknown> {
    return pageData
  }

  async translateProductCatalog(products: unknown[], _userLanguage: string): Promise<unknown[]> {
    return products
  }

  async translateWithBusinessContext(text: string, _language: string): Promise<string> {
    return text
  }
}

export const BusinessAgentFactory = {
  createForTenant(tenant: Tenant): BusinessAgent {
    return new BusinessAgentImpl(tenant)
  },
}
