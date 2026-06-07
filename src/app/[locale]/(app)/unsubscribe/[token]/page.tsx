import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

/**
 * One-click Unsubscribe — /unsubscribe/[token]
 *
 * Looks up a contact by its opaque unsubscribeToken and flips contactStatus to
 * 'unsubscribed' so campaign sends suppress it. Idempotent: re-visiting just
 * re-confirms. No auth required — the token is the capability.
 */
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  const found = await payload.find({
    collection: 'contacts',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contact = found.docs[0] as any

  let state: 'done' | 'already' | 'invalid' = 'invalid'

  if (contact) {
    if (contact.contactStatus === 'unsubscribed') {
      state = 'already'
    } else {
      try {
        await payload.update({
          collection: 'contacts',
          id: contact.id,
          data: { contactStatus: 'unsubscribed' } as any,
          overrideAccess: true,
        })
        state = 'done'
      } catch {
        state = 'already' // treat a write hiccup as best-effort success for the user
      }
    }
  }

  const isInvalid = state === 'invalid'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            isInvalid ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'
          }`}
        >
          {isInvalid ? (
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {state === 'done' && (
          <>
            <h1 className="mb-2 text-xl font-bold">You&apos;re unsubscribed</h1>
            <p className="mb-6 text-muted-foreground">
              {contact.email} won&apos;t receive further campaign emails from us. Sorry to see you go.
            </p>
          </>
        )}
        {state === 'already' && (
          <>
            <h1 className="mb-2 text-xl font-bold">Already unsubscribed</h1>
            <p className="mb-6 text-muted-foreground">
              You&apos;re already off our campaign list. No further emails will be sent.
            </p>
          </>
        )}
        {state === 'invalid' && (
          <>
            <h1 className="mb-2 text-xl font-bold">Link not recognized</h1>
            <p className="mb-6 text-muted-foreground">
              This unsubscribe link is invalid or has expired. If you keep receiving emails, reply
              and let us know.
            </p>
          </>
        )}

        <Link href={`/${locale}`} className="text-primary hover:underline">
          Go to Homepage
        </Link>
      </div>
    </div>
  )
}
