/**
 * Angel OS Stripe Connect Payment Adapter — Direct Charges
 *
 * Uses Stripe Connect DIRECT CHARGES model:
 * - Payment goes directly to the seller's connected account
 * - Platform takes application_fee_amount (40% via Ultimate Fair Split)
 * - Seller appears on customer's receipt (Enterprise sovereignty)
 * - Seller handles refunds and disputes (owner accountability)
 * - Buyers may be unaware of the platform (white-label)
 *
 * When a tenant has Stripe Connect enabled (stripeChargesEnabled: true),
 * the PaymentIntent is created ON the connected account with an
 * application_fee_amount. The platform receives the fee as an automatic transfer.
 *
 * When Connect is not enabled, standard payment processing applies
 * (payment goes to the platform account directly).
 *
 * @see https://docs.stripe.com/connect/direct-charges
 * @see src/lib/stripe-connect-config.ts — fee calculation
 * @see src/lib/ultimate-fair-split.ts — split constants
 */

import type { PayloadRequest } from 'payload'
import Stripe from 'stripe'
import { getPlatformFeeBps, feeCents } from '@/utilities/platformFee'
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
 * Custom Stripe adapter with Direct Charges for Connect.
 *
 * Direct charges: PaymentIntent is created ON the connected account.
 * The seller collects payment directly. Platform takes application_fee_amount.
 * Seller appears on receipt. Seller handles refunds/disputes.
 *
 * Returns stripeAccountId in initiatePayment response so the frontend
 * can initialize Stripe Elements with { stripeAccount: id } for the
 * correct connected account context.
 */
export function angelOsStripeAdapter(
  props: AngelOsStripeAdapterArgs,
): PaymentAdapter {
  const { secretKey, publishableKey, webhookSecret } = props

  // Resolve the platform secret key lazily: prefer the value passed at config
  // time, but fall back to the live env (so a key set AFTER module-load, or one
  // the build captured as empty, still works). Fail with a CLEAR, actionable
  // message instead of Stripe's cryptic "Neither apiKey nor config.authenticator
  // provided" — a missing STRIPE_SECRET_KEY is the #1 checkout outage.
  function resolveSecretKey(): string {
    const key = secretKey || process.env.STRIPE_SECRET_KEY || ''
    if (!key) {
      throw new Error(
        'Payments are not configured on this node — STRIPE_SECRET_KEY is missing. Set it in the environment and redeploy.',
      )
    }
    return key
  }

  // Lazy Stripe instance (platform account)
  let _stripe: Stripe | null = null
  function getStripe(): Stripe {
    if (!_stripe) {
      _stripe = new Stripe(resolveSecretKey(), {
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
      secretKey: resolveSecretKey(),
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
     * Initiate payment using Direct Charges when tenant has Connect enabled.
     *
     * Direct charges flow:
     * 1. Find/create customer ON the connected account
     * 2. Create PaymentIntent ON the connected account with application_fee_amount
     * 3. Return clientSecret + stripeAccountId for frontend Elements init
     *
     * Fallback (no Connect): standard charge to platform account.
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

      // Fulfillment method (from checkout additionalData). 'pickup' means the
      // buyer chose local pickup — no shipping address collected. Recorded on the
      // PaymentIntent so downstream order handling / receipts can skip shipping.
      const fulfillmentMethod =
        (req.data as Record<string, unknown> | undefined)?.['fulfillmentMethod'] === 'pickup'
          ? 'pickup'
          : 'ship'

      if (!currency) throw new Error('Currency is required.')
      if (!cart?.items?.length) throw new Error('Cart is empty or not provided.')
      if (!customerEmail || typeof customerEmail !== 'string')
        throw new Error('A valid customer email is required to make a purchase.')
      if (!amount || typeof amount !== 'number' || amount <= 0)
        throw new Error('A valid amount is required to initiate a payment.')

      // Resolve tenant's Stripe Connect status
      const connectAccount = await resolveTenantStripeAccount(req)
      const useDirectCharges = connectAccount?.chargesEnabled && connectAccount.stripeAccountId

      try {
        // Flatten cart items for metadata
        const flattenedCart = cart.items.map((item: any) => {
          const productID =
            typeof item.product === 'object' ? item.product.id : item.product
          const variantID = item.variant
            ? typeof item.variant === 'object'
              ? item.variant.id
              : item.variant
            : undefined
          // Drop the cart line-item's own `id` — reusing it as the transactions_items
          // id collides (transactions_items_pkey) when the SAME cart is checked out
          // more than once. Let Payload generate a fresh id per transaction item.
          const { product: _p, variant: _v, id: _id, ...customProps } = item
          return {
            ...customProps,
            product: productID,
            quantity: item.quantity,
            ...(variantID ? { variant: variantID } : {}),
          }
        })

        // --- Direct charges: customer + PaymentIntent on the connected account ---
        if (useDirectCharges) {
          const connectedAccountId = connectAccount.stripeAccountId

          // Find or create customer ON the connected account
          // (direct charges require customers to exist on the connected account)
          let customer = (
            await stripe.customers.list(
              { email: customerEmail, limit: 1 },
              { stripeAccount: connectedAccountId },
            )
          ).data[0]
          if (!customer?.id) {
            customer = await stripe.customers.create(
              { email: customerEmail },
              { stripeAccount: connectedAccountId },
            )
          }

          // Platform application fee — the CONFIGURED rate (5% default), not
          // ULTIMATE_FAIR_SPLIT's 40%. See src/utilities/platformFee.ts.
          // Scoped to the SELLING tenant — `connectAccount.tenantId` is whose
          // storefront took the money, which is whose negotiated rate applies.
          const applicationFee = feeCents(
            amount,
            await getPlatformFeeBps(payload, connectAccount.tenantId),
          )

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

          // Build PaymentIntent params for DIRECT CHARGE
          // No transfer_data — the charge IS on the connected account
          const intentParams: Stripe.PaymentIntentCreateParams = {
            amount,
            application_fee_amount: totalApplicationFee,
            // Whatever the Stripe Dashboard has enabled — Klarna, Affirm, Link,
            // Cash App — not a hardcoded list. `['card']` was silently switching
            // OFF every buy-now-pay-later method: PaymentElement can only render
            // what the PaymentIntent permits, so the client was never the
            // blocker. On a $599 device financing is not a nice-to-have, it is
            // the difference between one decision and a monthly one.
            // Redirect-based methods work because CheckoutForm already passes
            // return_url with redirect: 'if_required'.
            automatic_payment_methods: { enabled: true },
            currency,
            customer: customer.id,
            metadata: {
              cartID: String(cart.id),
              cartItemsSnapshot: JSON.stringify(flattenedCart),
              shippingAddress: JSON.stringify(data.shippingAddress || {}),
              angelOs_fulfillment: fulfillmentMethod,
              angelOs_splitEnabled: 'true',
              angelOs_chargeModel: 'direct',
              angelOs_platformAccount: 'self',
              angelOs_providerAccount: connectedAccountId,
              angelOs_applicationFee: String(applicationFee),
              angelOs_bootstrapFee: String(bootstrapFeeCents),
              angelOs_bootstrapTier: bootstrapTier,
              angelOs_totalPlatformFee: String(totalApplicationFee),
              angelOs_providerAmount: String(amount - totalApplicationFee),
            },
          }

          // Create PaymentIntent ON the connected account (direct charge)
          const paymentIntent = await stripe.paymentIntents.create(
            intentParams,
            { stripeAccount: connectedAccountId },
          )

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
            message: 'Payment initiated with Direct Charges (seller collects)',
            paymentIntentID: paymentIntent.id,
            // Frontend needs this to initialize Stripe Elements with the right account
            stripeAccountId: connectedAccountId,
          }
        }

        // --- Fallback: standard charge to platform account (no Connect) ---
        let customer = (
          await stripe.customers.list({ email: customerEmail })
        ).data[0]
        if (!customer?.id) {
          customer = await stripe.customers.create({ email: customerEmail })
        }

        const intentParams: Stripe.PaymentIntentCreateParams = {
          amount,
          // Same as the direct-charge path above: Dashboard decides, not code.
          automatic_payment_methods: { enabled: true },
          currency,
          customer: customer.id,
          metadata: {
            cartID: String(cart.id),
            cartItemsSnapshot: JSON.stringify(flattenedCart),
            shippingAddress: JSON.stringify(data.shippingAddress || {}),
            angelOs_fulfillment: fulfillmentMethod,
            angelOs_splitEnabled: 'false',
            angelOs_chargeModel: 'platform',
            angelOs_splitReason: connectAccount
              ? 'charges_not_enabled'
              : 'no_connect_account',
          },
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
          message: 'Payment initiated (platform account)',
          paymentIntentID: paymentIntent.id,
          // No stripeAccountId — frontend uses platform's default
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
