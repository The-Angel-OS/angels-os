import { headers } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { canManagePortal } from '@/utilities/canManagePortal'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { TicketFormBlockComponent } from '@/blocks/TicketForm/Component'

export const dynamic = 'force-dynamic'

const SUPPORT_FAQS = [
  {
    q: 'How fast does the Angel OS support team respond to incident tickets?',
    a: 'Tickets flagged High or Urgent are escalated immediately to the platform operations team via the AI Bus and Spaces escalation hooks. Normal support requests typically receive a response within one business day.',
  },
  {
    q: 'Where can I check the status of tickets I already submitted?',
    a: 'All tickets submitted from your account appear directly under "My Submitted Tickets" below, complete with INC- reference numbers, live state, priority, and any published resolution.',
  },
  {
    q: 'How do I connect my custom domain (e.g. mydomain.com)?',
    a: 'On the $10/mo Creator plan or above, open Settings → Domain & Menu, enter your domain name, and point one CNAME record to spacesangels.com. If DNS verification stalls, submit a Support ticket with your domain name.',
  },
  {
    q: 'How do Square and PayPal payouts settle to my bank?',
    a: 'Connect your Square or PayPal account under Settings → Payments & Payouts. Customer checkouts settle directly into your merchant account with automatic platform fee calculation.',
  },
  {
    q: 'Where do portal owners manage incoming customer tickets?',
    a: 'Portal owners and managers see Support → Incident Queue in the left sidebar to filter open incidents, assign owners, record internal work notes, and publish customer-visible resolutions.',
  },
]

/**
 * Dashboard Help & Support Center — /dashboard/support
 *
 * Security-aware workspace page:
 * - Anonymous visitors see a clean sign-in prompt (same pattern as /dashboard/my-orders).
 * - Authenticated members can submit support/warranty/return tickets, track
 *   their own INC- tickets & resolutions, and read support troubleshooting FAQs.
 * - Portal managers & platform admins additionally get a direct link to the
 *   staff Incident Queue (/dashboard/tickets).
 */
export default async function DashboardSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Sign in to access Help &amp; Support</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your support tickets and incident history are tied to your Angel OS account.
        </p>
        <Link
          href={`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/dashboard/support`)}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
      </div>
    )
  }

  const { tenantId } = await resolveTenantFromHeaders()
  const canManage =
    checkRole(ADMIN_ROLES, user) || (await canManagePortal(payload, user, tenantId))

  return (
    <div className="container max-w-5xl py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Support Center
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Help &amp; Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open an incident ticket, track your existing requests, or ask LEO in the right sidebar for 24/7 help.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${prefix}/dashboard/learn`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Learn Center
          </Link>
          {canManage && (
            <Link
              href={`${prefix}/dashboard/tickets`}
              className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Incident Queue →
            </Link>
          )}
        </div>
      </div>

      {/* 3 Quick Help Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Tracked INC Tickets</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Every support request gets an <span className="font-mono font-semibold text-foreground">INC-</span> reference number, priority triage, and live resolution status below.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Ask LEO 24/7</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Use the LEO assistant sidebar on the right for instant help with custom domains, Square/PayPal payouts, Print-on-Demand, or YouTube sync.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Creator Studio Guide</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Walk through step-by-step onboarding guides and platform documentation inside the{' '}
            <Link href={`${prefix}/dashboard/learn`} className="font-medium text-primary underline">
              Learn Center
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Incident Submission Form + Requester's My Submitted Tickets */}
      <TicketFormBlockComponent
        type="support"
        heading="Submit a Support Ticket"
        intro="Report a technical issue, request custom domain or payout assistance, or file a product/order claim."
        showOrderFields={false}
        confirmation="Your incident ticket has been logged with the Angel OS support team. Track its live status and resolution below anytime."
      />

      {/* Support & Troubleshooting FAQ */}
      <section className="mx-auto max-w-3xl pb-6">
        <h2 className="mb-4 text-lg font-bold">Support &amp; Troubleshooting FAQ</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {SUPPORT_FAQS.map((item, idx) => (
            <details
              key={idx}
              open={idx === 0}
              className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-medium">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-lg leading-none text-primary transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
