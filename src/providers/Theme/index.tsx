'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type { Theme, ThemeContextType } from './types'

import canUseDOM from '@/utilities/canUseDOM'
import { defaultTheme, getImplicitPreference, themeLocalStorageKey } from './shared'
import { themeIsValid } from './types'

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
}

const ThemeContext = createContext(initialContext)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme | undefined>(
    canUseDOM ? (document.documentElement.getAttribute('data-theme') as Theme) : undefined,
  )

  const setTheme = useCallback((themeToSet: Theme | null) => {
    if (themeToSet === null) {
      window.localStorage.removeItem(themeLocalStorageKey)
      const implicitPreference = getImplicitPreference()
      document.documentElement.setAttribute('data-theme', implicitPreference || '')
      if (implicitPreference) setThemeState(implicitPreference)
    } else {
      setThemeState(themeToSet)
      window.localStorage.setItem(themeLocalStorageKey, themeToSet)
      document.documentElement.setAttribute('data-theme', themeToSet)
    }
  }, [])

  useEffect(() => {
    // A saved user choice wins. Otherwise DON'T re-decide — defer to whatever
    // InitTheme already set on <html> (tenant default → OS → light), so the
    // per-tenant default from the server isn't clobbered on hydration.
    const preference = window.localStorage.getItem(themeLocalStorageKey)

    if (themeIsValid(preference)) {
      document.documentElement.setAttribute('data-theme', preference)
      setThemeState(preference)
    } else {
      const current = document.documentElement.getAttribute('data-theme')
      if (themeIsValid(current)) setThemeState(current as Theme)
      else {
        document.documentElement.setAttribute('data-theme', defaultTheme)
        setThemeState(defaultTheme)
      }
    }
  }, [])

  return <ThemeContext.Provider value={{ setTheme, theme }}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextType => useContext(ThemeContext)
