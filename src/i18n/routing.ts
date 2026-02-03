import { defineRouting } from 'next-intl/routing'

/**
 * next-intl routing configuration (Finly pattern).
 * See: https://finly.ch/engineering-blog/678698-zero-code-campaigns-how-we-built-a-multi-domain-lead-gen-engine-for-advisors
 */
export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})
