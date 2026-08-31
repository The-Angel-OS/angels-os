import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  // Derive the type from routing rather than restating the locale list here.
  // The list was hardcoded as 'en' | 'de'; removing 'de' from routing.ts broke
  // the BUILD, because this file still claimed it existed.
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
