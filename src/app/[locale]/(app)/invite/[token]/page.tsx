import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import Link from 'next/link'

/**
 * Invitation Landing Page — /invite/[token]
 *
 * Server component that shows invitation details and an accept button.
 * Handles expired, already-accepted, and invalid tokens gracefully.
 */
export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Look up the invitation by token
  const memberships = await payload.find({
    collection: 'space-memberships',
    where: {
      'invitationDetails.invitationToken': { equals: token },
    },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membership = memberships.docs[0] as any

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold">Invitation Not Found</h1>
          <p className="mb-6 text-muted-foreground">
            This invitation link is invalid or has been removed.
          </p>
          <Link href={`/${locale}`} className="text-primary hover:underline">
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  const space = typeof membership.space === 'object' ? membership.space : null
  const spaceName = space?.name || 'Unknown Space'
  const inviter = typeof membership.invitedBy === 'object' ? membership.invitedBy : null
  const inviterName = inviter?.name || inviter?.email || 'Someone'
  const inviteMessage = membership.invitationDetails?.invitationMessage
  const role = membership.role || 'member'
  const status = membership.status
  const expiresAt = membership.invitationDetails?.invitationExpiresAt
    ? new Date(membership.invitationDetails.invitationExpiresAt)
    : null
  const isExpired = expiresAt && expiresAt < new Date()

  // Already accepted
  if (status === 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold">Already Accepted</h1>
          <p className="mb-6 text-muted-foreground">
            You&apos;ve already joined <strong>{spaceName}</strong>.
          </p>
          <Link
            href={`/${locale}/dashboard/spaces`}
            className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Spaces
          </Link>
        </div>
      </div>
    )
  }

  // Expired
  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold">Invitation Expired</h1>
          <p className="mb-6 text-muted-foreground">
            This invitation to <strong>{spaceName}</strong> has expired. Ask {inviterName} to send a new one.
          </p>
          <Link href={`/${locale}`} className="text-primary hover:underline">
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const headersList = await headers()
  // In Payload, the user is on the req — but this is a server component.
  // We'll use a client-side accept flow via the API endpoint.

  // Valid pending invitation — show accept UI
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        {/* Angel OS logo */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">
          A
        </div>

        <h1 className="mb-2 text-center text-xl font-bold">You&apos;re Invited!</h1>
        <p className="mb-6 text-center text-muted-foreground">
          <strong>{inviterName}</strong> invited you to join
        </p>

        {/* Space card */}
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="text-lg font-semibold">{spaceName}</h2>
          <p className="text-sm text-muted-foreground">
            Role: <span className="capitalize">{role}</span>
          </p>
          {inviteMessage && (
            <p className="mt-2 text-sm italic text-muted-foreground">
              &ldquo;{inviteMessage}&rdquo;
            </p>
          )}
        </div>

        {/* Accept form — calls the API */}
        <form action={`/api/invite/accept`} method="POST">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Accept Invitation
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You may need to{' '}
          <Link href={`/${locale}/login`} className="text-primary hover:underline">
            sign in
          </Link>{' '}
          first.
        </p>

        {expiresAt && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Expires {expiresAt.toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
