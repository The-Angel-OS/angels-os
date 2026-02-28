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
        // Delay so user sees LEO's response before navigation
        setTimeout(() => router.push(detail.path), 1200)
      }
    }

    window.addEventListener('leo:navigate', handleNav)
    return () => window.removeEventListener('leo:navigate', handleNav)
  }, [router])
}
