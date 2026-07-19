'use client'

/**
 * RuntimeConfig — expose NEXT_PUBLIC_* values to CLIENT components at RUNTIME.
 *
 * NEXT_PUBLIC_* env vars are inlined into the client bundle at BUILD time. On a
 * self-hosted Docker build that lacks them, every `process.env.NEXT_PUBLIC_*`
 * read inside a 'use client' component is the empty string — which is what broke
 * Stripe Elements (checkout, booking deposit, donation) with "not configured".
 *
 * The fix: a SERVER component (Providers) reads process.env at runtime and seeds
 * this context. Any client component then reads the true runtime value via
 * useRuntimeConfig() instead of touching process.env directly. One place, whole
 * class of bug closed — the config-free-99 way.
 *
 * Rule of thumb: a client component must NEVER read process.env.NEXT_PUBLIC_* at
 * module or render scope. Add the value here and read it from the hook.
 */
import React, { createContext, useContext } from 'react'

export interface RuntimeConfigValue {
  stripePublishableKey: string
  gaMeasurementId: string
  livekitUrl: string
  serverUrl: string
}

const EMPTY: RuntimeConfigValue = {
  stripePublishableKey: '',
  gaMeasurementId: '',
  livekitUrl: '',
  serverUrl: '',
}

const RuntimeConfigContext = createContext<RuntimeConfigValue>(EMPTY)

export function RuntimeConfigProvider({
  value,
  children,
}: {
  value: RuntimeConfigValue
  children: React.ReactNode
}) {
  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>
}

export const useRuntimeConfig = (): RuntimeConfigValue => useContext(RuntimeConfigContext)
