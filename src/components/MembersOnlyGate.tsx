import React from 'react'
import Link from 'next/link'

/**
 * MembersOnlyGate — shown in place of a gated page's content when the viewer isn't
 * eligible. Friendly prompt + a way forward (log in / manage membership), instead of
 * a hard 404 or a redirect loop. The "Anti-Daemon" tone: warm, never a dead end.
 *
 * @see src/utilities/pageAccess.ts  @see docs/planning/MEMBERSHIP_GATING.md
 */
export function MembersOnlyGate({
  access,
  isAuthenticated,
  path,
}: {
  access: string
  isAuthenticated: boolean
  path: string
}) {
  const goodStanding = access === 'good_standing'
  const title = isAuthenticated ? 'Members only' : 'Members only — please sign in'
  const body = isAuthenticated
    ? goodStanding
      ? 'This page is for members in good standing. If your membership has lapsed, you can renew it from your account.'
      : 'This page is for members. You can start or manage your membership from your account.'
    : 'This page is available to members. Sign in to your account, or become a member to get access.'

  return (
    <section className="container py-24">
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="mb-3 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {!isAuthenticated && (
            <Link
              href={`/login?redirect=${encodeURIComponent(path)}`}
              className="rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Log in
            </Link>
          )}
          <Link
            // A signed-OUT visitor cannot "become a member" at /account — that
            // route needs the session they haven't got, so the one button meant to
            // convert them bounced them straight back out. Send them to sign up,
            // and carry the page they wanted so they land back on it afterwards.
            // (`/my` never existed as a route — this button 404'd for members.)
            href={isAuthenticated ? '/account' : `/create-account?redirect=${encodeURIComponent(path)}`}
            className="rounded-md border border-border px-5 py-2.5 font-medium hover:bg-accent"
          >
            {isAuthenticated ? 'Manage membership' : 'Become a member'}
          </Link>
        </div>
      </div>
    </section>
  )
}
