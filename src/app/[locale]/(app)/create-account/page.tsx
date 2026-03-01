import type { Metadata } from 'next'

import { RenderParams } from '@/components/RenderParams'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import React from 'react'
import { headers as getHeaders } from 'next/headers'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { CreateAccountForm } from '@/components/forms/CreateAccountForm'
import { redirect } from 'next/navigation'

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
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* ─── Left Column: Value Proposition ─────────────── */}
          <div className="hidden lg:flex flex-col justify-center py-8">
            <div className="mb-8">
              <p className="text-4xl font-bold tracking-tight mb-4" role="heading" aria-level={1}>
                {inviteContext?.spaceName
                  ? `You're invited to ${inviteContext.spaceName}`
                  : inviteContext?.tenantName
                    ? `Join ${inviteContext.tenantName}`
                    : 'Join the Federation'}
              </p>
              {inviteContext?.inviterName ? (
                <p className="text-lg text-muted-foreground">
                  {inviteContext.inviterName} invited you as a <strong>{inviteContext.role}</strong>.
                  Create your account to get started.
                </p>
              ) : (
                <p className="text-lg text-muted-foreground">
                  Angel OS is the platform for creators, makers, and communities building the future together.
                </p>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Launch your endeavor</h3>
                  <p className="text-sm text-muted-foreground">
                    Storefronts, communities, events, and services — all from one platform.
                    Your own domain. Your own brand. Your own rules.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Fair by design</h3>
                  <p className="text-sm text-muted-foreground">
                    Designers, manufacturers, and communities split revenue transparently.
                    No hidden fees. No extractive middlemen.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Your identity travels with you</h3>
                  <p className="text-sm text-muted-foreground">
                    Your reputation, reviews, and credentials live in a portable suitcase.
                    Move between tenants freely — your work follows you.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t">
              <p className="text-xs text-muted-foreground">
                Trusted by creators, makers, and communities worldwide.
                <br />
                Angel OS is open source. Your data belongs to you.
              </p>
            </div>
          </div>

          {/* ─── Right Column: Sign-up Form ────────────────── */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* Mobile-only header */}
            <div className="lg:hidden mb-8">
              <h1 className="text-2xl font-bold tracking-tight mb-2">
                {inviteContext?.spaceName
                  ? `Join ${inviteContext.spaceName}`
                  : inviteContext?.tenantName
                    ? `Join ${inviteContext.tenantName}`
                    : 'Create your account'}
              </h1>
              {inviteContext?.inviterName && (
                <p className="text-muted-foreground">
                  {inviteContext.inviterName} invited you as a <strong>{inviteContext.role}</strong>.
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-6 sm:p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Get started</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your account in seconds
                </p>
              </div>

              <RenderParams />
              <CreateAccountForm />
            </div>

            <p className="text-xs text-center text-muted-foreground mt-6">
              By creating an account, you agree to Angel OS&apos;s{' '}
              <a href="/terms" className="underline hover:text-primary">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a>.
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
