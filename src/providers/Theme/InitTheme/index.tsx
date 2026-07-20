import Script from 'next/script'
import React from 'react'

import { defaultTheme, themeLocalStorageKey } from '../shared'

/**
 * Sets the initial `data-theme` before paint (no flash). Resolution order:
 *   1. the visitor's saved choice (localStorage)
 *   2. the tenant's configured default (branding.defaultTheme: 'light' | 'dark')
 *   3. the visitor's OS preference (prefers-color-scheme)
 *   4. the site default ('light')
 * So a brand can pin its site light/dark (e.g. NeuroCare Pro = light) while tenants
 * that leave it unset still follow the visitor's OS.
 */
export const InitTheme: React.FC<{ tenantDefault?: string | null }> = ({ tenantDefault }) => {
  const td = tenantDefault === 'light' || tenantDefault === 'dark' ? tenantDefault : ''
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    function getImplicitPreference() {
      var mql = window.matchMedia('(prefers-color-scheme: dark)')
      return typeof mql.matches === 'boolean' ? (mql.matches ? 'dark' : 'light') : null
    }
    function themeIsValid(theme) { return theme === 'light' || theme === 'dark' }

    var themeToSet = '${defaultTheme}'
    var preference = window.localStorage.getItem('${themeLocalStorageKey}')
    var tenantDefault = '${td}'

    if (themeIsValid(preference)) {
      themeToSet = preference
    } else if (themeIsValid(tenantDefault)) {
      themeToSet = tenantDefault
    } else {
      var implicitPreference = getImplicitPreference()
      if (implicitPreference) themeToSet = implicitPreference
    }

    document.documentElement.setAttribute('data-theme', themeToSet)
  })();
  `,
      }}
      id="theme-script"
      strategy="beforeInteractive"
    />
  )
}
