import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import React from 'react'

import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { LoginForm } from '@/components/forms/LoginForm'
import { redirect } from 'next/navigation'
import { StarfleetSacredSVG } from '@/components/StarfleetSacredSVG'

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    const params = await searchParams
    const target =
      params.redirect && params.redirect.startsWith('/') ? params.redirect : '/dashboard'
    redirect(target)
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--lcars-dark-bg)' }}
    >
      {/* Scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }}
      />

      {/* Background sacred geometry — large, centered, subtle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
        <StarfleetSacredSVG className="w-[600px] h-[600px] opacity-20" />
      </div>

      {/* Content */}
      <div className="relative z-20 w-full max-w-md mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <StarfleetSacredSVG className="w-16 h-16 mx-auto mb-4 opacity-80" particles={false} />
          <h1
            className="text-2xl font-mono tracking-[0.2em] uppercase mb-1"
            style={{ color: 'var(--lcars-amber)' }}
          >
            Angel OS
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--lcars-text-muted)' }}>
            Welcome back, Officer
          </p>
        </div>

        {/* Login card — permanently dark glass. `auth-card` pins the contrast
            surfaces to values chosen against THIS card rather than a page
            background, so the fields read in site light AND dark mode. It
            replaces a data-theme="dark" pin that fixed light mode and caused
            the dark-mode black-on-black. Same class on create-account. */}
        <div
          className="auth-card rounded-xl border p-6"
          style={{
            background: 'rgba(17, 17, 34, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'rgba(245, 166, 35, 0.15)',
          }}
        >
          <RenderParams />
          <LoginForm />
        </div>

        {/* LCARS decorative bar */}
        <div className="flex gap-1 mt-6 justify-center">
          <div
            className="h-1 w-16 rounded-full opacity-40"
            style={{ background: 'var(--lcars-amber)' }}
          />
          <div
            className="h-1 w-8 rounded-full opacity-30"
            style={{ background: 'var(--lcars-blue)' }}
          />
          <div
            className="h-1 w-4 rounded-full opacity-20"
            style={{ background: 'var(--lcars-lavender)' }}
          />
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Login or create an account to get started.',
  openGraph: {
    title: 'Login',
    url: '/login',
  },
  title: 'Login',
}
