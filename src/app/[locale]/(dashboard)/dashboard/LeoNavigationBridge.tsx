'use client'

import { useLeoNavigation } from '@/hooks/useLeoNavigation'

/**
 * Invisible client component that bridges LEO tool actions to dashboard navigation.
 * Mounted in the dashboard layout so it catches all `leo:navigate` events from
 * any chat surface (sidebar, full-page, bubble).
 *
 * @see src/hooks/useLeoNavigation.ts — the underlying hook
 */
export function LeoNavigationBridge() {
  useLeoNavigation()
  return null
}
