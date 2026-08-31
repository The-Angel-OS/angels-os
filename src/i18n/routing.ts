import { defineRouting } from 'next-intl/routing'

/**
 * next-intl routing configuration (Finly pattern).
 * See: https://finly.ch/engineering-blog/678698-zero-code-campaigns-how-we-built-a-multi-domain-lead-gen-engine-for-advisors
 */
/**
 * English only, deliberately.
 *
 * `de` was listed here and it was a trap. next-intl detects a locale, PERSISTS it
 * in a NEXT_LOCALE cookie, and the cookie then outranks the browser forever —
 * and there is no language switcher anywhere in this app to undo it. Ken's own
 * browser reported en-US while every page he opened redirected to /de, which is
 * how a German URL ended up in a demo of an English product.
 *
 * What /de actually delivered made the trap worse: messages/de.json is FOUR
 * strings, and Payload has no content localization configured at all, so every
 * page, post and product was English regardless. The locale bought a German URL,
 * a stuck cookie and nothing else.
 *
 * Add it back when there is German content and a way to switch back — in that
 * order.
 */
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})
