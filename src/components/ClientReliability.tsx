'use client'

import { useEffect, type ReactNode } from 'react'
import { createApiInterceptor } from '@/utilities/apiInterceptor'
import { AngelErrorBoundary } from '@/components/AngelErrorBoundary'

/**
 * ClientReliability — the client-side reliability spine, mounted once at the app root.
 *
 * Two defenses the audit found were dead code (never imported / never mounted):
 *  - createApiInterceptor() patches window.fetch so genuine client fetch failures
 *    (4xx + network errors, deduped, poll-skipped, own-5xx-skipped) escalate to the
 *    canonical error log instead of dying in the console.
 *  - AngelErrorBoundary catches a render crash in the app tree and escalates it.
 */
export function ClientReliability({ children }: { children: ReactNode }) {
  useEffect(() => {
    createApiInterceptor()
  }, [])
  return <AngelErrorBoundary section="app">{children}</AngelErrorBoundary>
}
