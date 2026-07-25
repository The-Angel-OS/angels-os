'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * LEO Navigation Bridge — Client Hook
 *
 * Listens for `leo:navigate` custom events dispatched by useChat when LEO
 * executes a tool that produces a data mutation. Navigates the dashboard
 * to show the result so the user sees their changes immediately.
 *
 * The slight delay (1.2s) ensures the user reads LEO's response before
 * the page transitions.
 *
 * @see src/utilities/leo-data-tools.ts — navDirective() helper
 * @see src/endpoints/leo-stream.ts — extractNavDirective/stripNavDirective
 * @see src/components/ChatControl/useChat.ts — dispatches leo:navigate
 */
export function useLeoNavigation() {
  const router = useRouter()

  useEffect(() => {
    function handleNav(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail?.path && typeof detail.path === 'string') {
        // When the directive carries an endeavor to activate (e.g. commission_endeavor
        // just stood one up), set the validated active-endeavor cookie FIRST so the
        // destination resolves to the new endeavor in-app — the user lands standing
        // inside it, no cross-origin subdomain reload. The cookie is authorized
        // server-side against the user's membership (resolveActiveTenant).
        if (detail.activateEndeavor != null) {
          const maxAge = 60 * 60 * 24 * 365 // 1 year
          document.cookie = `active-endeavor=${encodeURIComponent(String(detail.activateEndeavor))}; max-age=${maxAge}; path=/; samesite=lax`
        }
        // Delay so user sees LEO's response before navigation
        setTimeout(() => {
          router.push(detail.path)
          // refresh() forces the server layout to re-resolve the (now-active) tenant
          // even when path === current route.
          if (detail.activateEndeavor != null) router.refresh()
        }, 1200)
      }
    }

    window.addEventListener('leo:navigate', handleNav)
    return () => window.removeEventListener('leo:navigate', handleNav)
  }, [router])
}
