import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { CreateAccountForm } from '@/components/forms/CreateAccountForm'
import { redirect } from 'next/navigation'
import { StarfleetSacredSVG } from '@/components/StarfleetSacredSVG'

export default async function CreateAccount({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  if (user) {
    redirect(`/account?warning=${encodeURIComponent('You are already logged in.')}`)
  }

  const searchParams = await searchParamsPromise

  // If arriving from an invite, resolve the invite context for display
  const inviteToken = typeof searchParams.invite === 'string' ? searchParams.invite : null
  const inviteType = typeof searchParams.inviteType === 'string' ? searchParams.inviteType : null
  let inviteContext: { spaceName?: string; tenantName?: string; inviterName?: string; role?: string } | null = null

  if (inviteToken && inviteType) {
    try {
      if (inviteType === 'space') {
        const memberships = await payload.find({
          collection: 'space-memberships',
          where: { invitationToken: { equals: inviteToken }, invitationStatus: { equals: 'pending' } },
          limit: 1,
          depth: 1,
          overrideAccess: true,
        })
        const membership = memberships.docs[0] as any
        if (membership) {
          const space = typeof membership.space === 'object' ? membership.space : null
          const inviter = typeof membership.initialUser === 'object' ? membership.initialUser : null
          inviteContext = {
            spaceName: space?.name || 'a space',
            inviterName: inviter?.name || inviter?.email || 'Someone',
            role: membership.role || 'member',
          }
        }
      } else if (inviteType === 'tenant') {
        const memberships = await payload.find({
          collection: 'tenant-memberships',
          where: { invitationToken: { equals: inviteToken }, invitationStatus: { equals: 'pending' } },
          limit: 1,
          depth: 1,
          overrideAccess: true,
        })
        const membership = memberships.docs[0] as any
        if (membership) {
          const tenant = typeof membership.tenant === 'object' ? membership.tenant : null
          inviteContext = {
            tenantName: tenant?.name || 'an organization',
            role: membership.role || 'member',
          }
        }
      }
    } catch {
      // Invite context is nice-to-have, not required
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden"
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

      {/* Background sacred geometry */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
        <StarfleetSacredSVG className="w-[700px] h-[700px] opacity-10" />
      </div>

      <div className="relative z-20 container max-w-6xl mx-auto py-12 px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column: Value Proposition */}
          <div className="hidden lg:flex flex-col justify-center py-8">
            <div className="mb-8">
              <StarfleetSacredSVG className="w-12 h-12 mb-4 opacity-70" particles={false} />
              <p
                className="text-4xl font-mono tracking-tight mb-4"
                role="heading"
                aria-level={1}
                style={{ color: 'var(--lcars-amber)' }}
              >
                {inviteContext?.spaceName
                  ? `You're invited to ${inviteContext.spaceName}`
                  : inviteContext?.tenantName
                    ? `Join ${inviteContext.tenantName}`
                    : 'Join the Federation'}
              </p>
              {inviteContext?.inviterName ? (
                <p className="text-lg" style={{ color: 'var(--lcars-text-muted)' }}>
                  {inviteContext.inviterName} invited you as a <strong style={{ color: 'var(--lcars-peach)' }}>{inviteContext.role}</strong>.
                  Create your account to get started.
                </p>
              ) : (
                <p className="text-lg" style={{ color: 'var(--lcars-text-muted)' }}>
                  Angel OS is the platform for creators, makers, and communities building the future together.
                </p>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(245, 166, 35, 0.1)' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--lcars-amber)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1 font-mono" style={{ color: 'var(--lcars-peach)' }}>Launch your endeavor</h3>
                  <p className="text-sm" style={{ color: 'var(--lcars-text-muted)' }}>
                    Storefronts, communities, events, and services — all from one platform.
                    Your own domain. Your own brand. Your own rules.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(153, 204, 255, 0.1)' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--lcars-blue)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1 font-mono" style={{ color: 'var(--lcars-blue)' }}>Fair by design</h3>
                  <p className="text-sm" style={{ color: 'var(--lcars-text-muted)' }}>
                    Designers, manufacturers, and communities split revenue transparently.
                    No hidden fees. No extractive middlemen.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(204, 153, 204, 0.1)' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--lcars-lavender)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1 font-mono" style={{ color: 'var(--lcars-lavender)' }}>Your identity travels with you</h3>
                  <p className="text-sm" style={{ color: 'var(--lcars-text-muted)' }}>
                    Your reputation, reviews, and credentials live in a portable suitcase.
                    Move between tenants freely — your work follows you.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8" style={{ borderTop: '1px solid rgba(245, 166, 35, 0.1)' }}>
              <p className="text-xs" style={{ color: 'var(--lcars-text-muted)' }}>
                Trusted by creators, makers, and communities worldwide.
                <br />
                Angel OS is open source. Your data belongs to you.
              </p>
            </div>
          </div>

          {/* Right Column: Sign-up Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center min-h-[calc(100vh-6rem)]">
            {/* Mobile-only header */}
            <div className="lg:hidden mb-8">
              <StarfleetSacredSVG className="w-12 h-12 mb-4 opacity-70" particles={false} />
              <h1
                className="text-2xl font-mono tracking-tight mb-2"
                style={{ color: 'var(--lcars-amber)' }}
              >
                {inviteContext?.spaceName
                  ? `Join ${inviteContext.spaceName}`
                  : inviteContext?.tenantName
                    ? `Join ${inviteContext.tenantName}`
                    : 'Create your account'}
              </h1>
              {inviteContext?.inviterName && (
                <p style={{ color: 'var(--lcars-text-muted)' }}>
                  {inviteContext.inviterName} invited you as a <strong style={{ color: 'var(--lcars-peach)' }}>{inviteContext.role}</strong>.
                </p>
              )}
            </div>

            <div
              className="rounded-xl border p-6 sm:p-8"
              style={{
                background: 'rgba(17, 17, 34, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderColor: 'rgba(245, 166, 35, 0.15)',
              }}
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold font-mono" style={{ color: 'var(--lcars-peach)' }}>Get started</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--lcars-text-muted)' }}>
                  Create your account in seconds
                </p>
              </div>

              <RenderParams />
              <CreateAccountForm />
            </div>

            <p className="text-xs text-center mt-6" style={{ color: 'var(--lcars-text-muted)' }}>
              By creating an account, you agree to Angel OS&apos;s{' '}
              <Link href="/terms" className="underline" style={{ color: 'var(--lcars-blue)' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline" style={{ color: 'var(--lcars-blue)' }}>Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Join the Federation — Angel OS is the platform for creators, makers, and communities building the future together.',
  openGraph: mergeOpenGraph({
    title: 'Join the Federation',
    url: '/create-account',
  }),
  title: 'Join the Federation',
}
