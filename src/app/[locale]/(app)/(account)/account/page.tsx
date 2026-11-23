import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import configPromise from '@payload-config'
import { AccountForm } from '@/components/forms/AccountForm'
import { MembershipBlock } from '@/blocks/Membership/Component'
import { SocialProvidersPanel } from '@/components/forms/SocialProvidersPanel'
import { Order } from '@/payload-types'
import { OrderItem } from '@/components/OrderItem'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  let orders: Order[] | null = null
  let ticketCount = 0

  if (!user) {
    redirect(
      `/login?warning=${encodeURIComponent('Please login to access your account settings.')}`,
    )
  }

  try {
    const [ordersResult, ticketResult] = await Promise.all([
      payload.find({
        collection: 'orders',
        limit: 5,
        user,
        overrideAccess: false,
        pagination: false,
        where: {
          customer: {
            equals: user?.id,
          },
        },
      }),
      payload
        .count({
          collection: 'tickets',
          where: { requester: { equals: user.id } },
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 })),
    ])

    orders = ordersResult?.docs || []
    ticketCount = ticketResult?.totalDocs || 0
  } catch (error) {
    // when deploying this template on Payload Cloud, this page needs to build before the APIs are live
    // so swallow the error here and simply render the page with fallback data where necessary
    // in production you may want to redirect to a 404  page or at least log the error somewhere
    // console.error(error)
  }

  return (
    <>
      <div className="border p-8 rounded-lg bg-card text-card-foreground">
        <h1 className="text-3xl font-medium mb-8">Account settings</h1>
        <AccountForm />
      </div>

      {/* Membership. The block self-fetches the HOST endeavor's plans and the
          viewer's own subscription, so this one line is both "join" and "manage
          card / cancel" — and it's where MembersOnlyGate sends a locked-out
          member. Renders nothing when the endeavor sells no plans. */}
      <div className="border p-8 rounded-lg bg-card text-card-foreground">
        <h2 className="text-3xl font-medium mb-8">Membership</h2>
        <MembershipBlock ctaText="Become a member" />
      </div>

      <div className="border p-8 rounded-lg bg-card text-card-foreground">
        <h2 className="text-3xl font-medium mb-8">Connected Accounts</h2>
        <SocialProvidersPanel />
      </div>

      <div className="border p-8 rounded-lg bg-card text-card-foreground">
        <h2 className="text-3xl font-medium mb-8">Recent Orders</h2>

        <div className="prose dark:prose-invert mb-8">
          <p>
            These are the most recent orders you have placed. Each order is associated with an
            payment. As you place more orders, they will appear in your orders list.
          </p>
        </div>

        {(!orders || !Array.isArray(orders) || orders?.length === 0) && (
          <p className="mb-8">You have no orders.</p>
        )}

        {orders && orders.length > 0 && (
          <ul className="flex flex-col gap-6 mb-8">
            {orders?.map((order, index) => (
              <li key={order.id}>
                <OrderItem order={order} />
              </li>
            ))}
          </ul>
        )}

        <Button asChild variant="default">
          <Link href="/orders">View all orders</Link>
        </Button>
      </div>

      <div className="border p-8 rounded-lg bg-card text-card-foreground">
        <h2 className="text-3xl font-medium mb-4">Support Tickets</h2>
        <p className="text-muted-foreground mb-6">
          {ticketCount > 0
            ? `You have ${ticketCount} submitted support ${ticketCount === 1 ? 'ticket' : 'tickets'} tracked in the Help Center.`
            : 'Need help with a portal, order, custom domain, or warranty claim? Open a tracked incident ticket anytime.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="default">
            <Link href="/help#my-tickets">Open Help Desk / Track Tickets</Link>
          </Button>
        </div>
      </div>
    </>
  )
}

export const metadata: Metadata = {
  description: 'Create an account or log in to your existing account.',
  openGraph: mergeOpenGraph({
    title: 'Account',
    url: '/account',
  }),
  title: 'Account',
}
