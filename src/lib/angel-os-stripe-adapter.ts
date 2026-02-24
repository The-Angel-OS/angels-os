/**
 * Angel OS Stripe Connect Payment Adapter
 *
 * Wraps the default Payload ecommerce Stripe adapter to inject:
 * - transfer_data.destination → tenant's connected Stripe account
 * - application_fee_amount → 40% platform fee (Ultimate Fair Split)
 *
 * When a tenant has Stripe Connect enabled (stripeChargesEnabled: true),
 * payments are split at the point of sale: 60% to provider, 40% retained.
 * When Connect is not enabled, standard payment processing applies.
 *
 * @see src/lib/stripe-connect-config.ts — fee calculation
 * @see src/lib/ultimate-fair-split.ts — split constants
 */

import type { PayloadRequest } from 'payload'
import Stripe from 'stripe'
import { getStripeApplicationFeeCents } from './stripe-connect-config'
import { calculateBootstrapFee } from '@/utilities/bootstrapFees'

// Re-export the client adapter as-is (no changes needed on the client side)
export { stripeAdapterClient } from '@payloadcms/plugin-ecommerce/payments/stripe'

type PaymentAdapter = {
  confirmOrder: (...args: any[]) => any
  endpoints?: any[]
  group: any
  initiatePayment: (...args: any[]) => any
  label?: string
  name: string
}

interface AngelOsStripeAdapterArgs {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}

/**
 * Resolve the tenant's Stripe Connect account ID from the request.
 * Returns null if the tenant doesn't have Connect enabled.
 */
async function resolveTenantStripeAccount(
  req: PayloadRequest,
): Promise<{ tenantId: number; stripeAccountId: string; chargesEnabled: boolean } | null> {
  try {
    const tenantSlug =
      req.headers.get('x-tenant-id') ||
      process.env.DEFAULT_TENANT_SLUG ||
      'default'

    const tenants = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const tenant = tenants.docs?.[0] as unknown as Record<string, unknown> | undefined
    if (!tenant) return null

    const connect = tenant.stripeConnect as Record<string, unknown> | undefined
    if (!connect?.stripeAccountId) return null

    return {
      tenantId: tenant.id as number,
      stripeAccountId: connect.stripeAccountId as string,
      chargesEnabled: Boolean(connect.stripeChargesEnabled),
    }
  } catch {
    return null
  }
}

/**
 * Custom Stripe adapter with Connect split payments.
 *
 * Mirrors the default stripeAdapter interface but injects transfer_data
 * and application_fee_amount on PaymentIntents when the tenant has
 * a connected Stripe account with charges enabled.
 */
export function angelOsStripeAdapter(
  props: AngelOsStripeAdapterArgs,
): PaymentAdapter {
  const { secretKey, publishableKey, webhookSecret } = props

  // Lazy Stripe instance
  let _stripe: Stripe | null = null
  function getStripe(): Stripe {
    if (!_stripe) {
      _stripe = new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil' as any,
        appInfo: {
          name: 'Angel OS Platform',
          url: 'https://angelos.app',
        },
      })
    }
    return _stripe
  }

  // Import the default stripeAdapter to reuse confirmOrder and group/endpoints
  // We'll construct these lazily since the import is sync
  let _baseAdapter: PaymentAdapter | null = null
  async function getBaseAdapter(): Promise<PaymentAdapter> {
    if (_baseAdapter) return _baseAdapter
    const { stripeAdapter } = await import(
      '@payloadcms/plugin-ecommerce/payments/stripe'
    )
    _baseAdapter = stripeAdapter({
      secretKey,
      publishableKey,
      webhookSecret,
    }) as PaymentAdapter
    return _baseAdapter
  }

  return {
    name: 'stripe',

    // Group field for admin UI (same as default stripe adapter)
    group: {
      name: 'stripe',
      type: 'group' as const,
      admin: {
        condition: (data: Record<string, unknown>) =>
          data?.paymentMethod === 'stripe',
      },
      fields: [
        {
          name: 'customerID',
          type: 'text' as const,
          label: 'Stripe Customer ID',
        },
        {
          name: 'paymentIntentID',
          type: 'text' as const,
          label: 'Stripe PaymentIntent ID',
        },
      ],
    },

    /**
     * Initiate payment with Connect split when tenant is connected.
     */
    initiatePayment: async ({
      data,
      req,
      transactionsSlug,
    }: {
      data: {
        billingAddress: Record<string, unknown>
        cart: { id: string | number; items: any[]; subtotal?: number }
        currency: string
        customerEmail: string
        shippingAddress?: Record<string, unknown>
      }
      req: PayloadRequest
      transactionsSlug: string
    }) => {
      const payload = req.payload
      const stripe = getStripe()
      const { customerEmail, currency, cart } = data
      const amount = cart.subtotal

      if (!currency) throw new Error('Currency is required.')
      if (!cart?.items?.length) throw new Error('Cart is empty or not provided.')
      if (!customerEmail || typeof customerEmail !== 'string')
        throw new Error('A valid customer email is required to make a purchase.')
      if (!amount || typeof amount !== 'number' || amount <= 0)
        throw new Error('A valid amount is required to initiate a payment.')

      // Resolve tenant's Stripe Connect status
      const connectAccount = await resolveTenantStripeAccount(req)

      try {
        // Find or create Stripe customer
        let customer = (
          await stripe.customers.list({ email: customerEmail })
        ).data[0]
        if (!customer?.id) {
          customer = await stripe.customers.create({ email: customerEmail })
        }

        // Flatten cart items for metadata
        const flattenedCart = cart.items.map((item: any) => {
          const productID =
            typeof item.product === 'object' ? item.product.id : item.product
          const variantID = item.variant
            ? typeof item.variant === 'object'
              ? item.variant.id
              : item.variant
            : undefined
          const { product: _p, variant: _v, ...customProps } = item
          return {
            ...customProps,
            product: productID,
            quantity: item.quantity,
            ...(variantID ? { variant: variantID } : {}),
          }
        })

        // Build PaymentIntent params
        const intentParams: Stripe.PaymentIntentCreateParams = {
          amount,
          automatic_payment_methods: { enabled: true },
          currency,
          customer: customer.id,
          metadata: {
            cartID: String(cart.id),
            cartItemsSnapshot: JSON.stringify(flattenedCart),
            shippingAddress: JSON.stringify(data.shippingAddress || {}),
          },
        }

        // Inject Connect split if tenant has charges enabled
        if (connectAccount?.chargesEnabled && connectAccount.stripeAccountId) {
          const applicationFee = getStripeApplicationFeeCents(amount)

          // Calculate bootstrap fee (may be 0 if in free tier or standard)
          let bootstrapFeeCents = 0
          let bootstrapTier = 'unknown'
          try {
            const bfResult = await calculateBootstrapFee(connectAccount.tenantId, amount)
            bootstrapFeeCents = bfResult.bootstrapFeeCents
            bootstrapTier = bfResult.tier
          } catch (err) {
            payload.logger.warn('Bootstrap fee calculation failed, proceeding without: %s', err)
          }

          const totalApplicationFee = applicationFee + bootstrapFeeCents

          intentParams.transfer_data = {
            destination: connectAccount.stripeAccountId,
          }
          intentParams.application_fee_amount = totalApplicationFee

          // Add split metadata for webhook reconciliation
          intentParams.metadata = {
            ...intentParams.metadata,
            angelOs_splitEnabled: 'true',
            angelOs_providerAccount: connectAccount.stripeAccountId,
            angelOs_applicationFee: String(applicationFee),
            angelOs_bootstrapFee: String(bootstrapFeeCents),
            angelOs_bootstrapTier: bootstrapTier,
            angelOs_totalPlatformFee: String(totalApplicationFee),
            angelOs_providerAmount: String(amount - totalApplicationFee),
          }
        } else if (connectAccount && !connectAccount.chargesEnabled) {
          // Connected but charges not yet enabled — note in metadata
          intentParams.metadata = {
            ...intentParams.metadata,
            angelOs_splitEnabled: 'false',
            angelOs_splitReason: 'charges_not_enabled',
          }
        }

        const paymentIntent = await stripe.paymentIntents.create(intentParams)

        // Create transaction record
        await payload.create({
          collection: transactionsSlug as any,
          data: {
            ...(req.user ? { customer: req.user.id } : { customerEmail }),
            amount: paymentIntent.amount,
            billingAddress: data.billingAddress,
            cart: cart.id,
            currency: paymentIntent.currency.toUpperCase(),
            items: flattenedCart,
            paymentMethod: 'stripe',
            status: 'pending',
            stripe: {
              customerID: customer.id,
              paymentIntentID: paymentIntent.id,
            },
          } as any,
        })

        return {
          clientSecret: paymentIntent.client_secret || '',
          message: connectAccount?.chargesEnabled
            ? 'Payment initiated with Connect split'
            : 'Payment initiated successfully',
          paymentIntentID: paymentIntent.id,
        }
      } catch (error) {
        payload.logger.error(error, 'Error initiating payment with Angel OS Stripe adapter')
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Unknown error initiating payment',
        )
      }
    },

    /**
     * Confirm order — delegates to the default stripe adapter's confirmOrder.
     * No split logic needed here (the split is already on the PaymentIntent).
     */
    confirmOrder: async (args: any) => {
      const base = await getBaseAdapter()
      return base.confirmOrder(args)
    },
  }
}
