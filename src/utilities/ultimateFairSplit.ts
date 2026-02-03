import Stripe from 'stripe'

export interface UltimateFairConfig {
  providerShare: number // Default: 60%
  platformShare: number // Default: 20% 
  operationsShare: number // Default: 15%
  justiceShare: number // Default: 5%
}

export interface PaymentSplit {
  totalAmount: number
  currency: string
  providerAmount: number
  platformAmount: number
  operationsAmount: number
  justiceAmount: number
  stripeApplicationFee: number
  netToProvider: number
}

export interface SplitResult {
  paymentIntent: Stripe.PaymentIntent
  splits: PaymentSplit
  transferIds: string[]
  metadata: Record<string, any>
}

/**
 * Ultimate Fair Payment Splitting System
 * Implements the Angel OS economic model: 60/20/15/5 split
 * Provider / Platform / Operations / Justice Fund
 */
export class UltimateFairSplitter {
  private stripe: Stripe
  private defaultConfig: UltimateFairConfig

  constructor(stripeSecretKey: string, config?: Partial<UltimateFairConfig>) {
    this.stripe = new Stripe(stripeSecretKey)
    this.defaultConfig = {
      providerShare: 60,
      platformShare: 20,
      operationsShare: 15,
      justiceShare: 5,
      ...config
    }
  }

  /**
   * Calculate payment splits according to Ultimate Fair model
   */
  calculateSplit(
    amount: number, 
    currency: string = 'usd',
    customConfig?: Partial<UltimateFairConfig>
  ): PaymentSplit {
    const config = { ...this.defaultConfig, ...customConfig }
    
    // Validate percentages sum to 100
    const totalPercentage = config.providerShare + config.platformShare + 
                           config.operationsShare + config.justiceShare
    
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Ultimate Fair percentages must sum to 100%. Current: ${totalPercentage}%`)
    }

    // Calculate amounts (Stripe uses cents for USD)
    const isZeroDecimalCurrency = ['jpy', 'krw'].includes(currency.toLowerCase())
    const multiplier = isZeroDecimalCurrency ? 1 : 100
    const totalAmountCents = Math.round(amount * multiplier)

    const providerAmountCents = Math.round(totalAmountCents * config.providerShare / 100)
    const platformAmountCents = Math.round(totalAmountCents * config.platformShare / 100)
    const operationsAmountCents = Math.round(totalAmountCents * config.operationsShare / 100)
    const justiceAmountCents = Math.round(totalAmountCents * config.justiceShare / 100)

    // Stripe application fee (platform + operations + justice)
    const applicationFeeCents = platformAmountCents + operationsAmountCents + justiceAmountCents

    return {
      totalAmount: amount,
      currency,
      providerAmount: providerAmountCents / multiplier,
      platformAmount: platformAmountCents / multiplier,
      operationsAmount: operationsAmountCents / multiplier,
      justiceAmount: justiceAmountCents / multiplier,
      stripeApplicationFee: applicationFeeCents / multiplier,
      netToProvider: providerAmountCents / multiplier
    }
  }

  /**
   * Create a Stripe Connect payment with Ultimate Fair splitting
   */
  async createSplitPayment(
    amount: number,
    currency: string,
    providerStripeAccountId: string,
    metadata: {
      bookingId: string
      tenantId: string
      providerId: string
      clientId: string
      bookingType: string
      [key: string]: any
    },
    customConfig?: Partial<UltimateFairConfig>
  ): Promise<SplitResult> {
    const splits = this.calculateSplit(amount, currency, customConfig)
    const multiplier = ['jpy', 'krw'].includes(currency.toLowerCase()) ? 1 : 100

    // Create payment intent with Stripe Connect
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(splits.totalAmount * multiplier),
      currency,
      application_fee_amount: Math.round(splits.stripeApplicationFee * multiplier),
      transfer_data: {
        destination: providerStripeAccountId,
      },
      metadata: {
        ...metadata,
        ultimateFairSplit: 'true',
        providerShare: splits.providerAmount.toString(),
        platformShare: splits.platformAmount.toString(),
        operationsShare: splits.operationsAmount.toString(),
        justiceShare: splits.justiceAmount.toString(),
      }
    })

    return {
      paymentIntent,
      splits,
      transferIds: [], // Will be populated when payment is captured
      metadata
    }
  }

  /**
   * Process platform fee distribution after payment capture
   * Distributes application fee between Platform, Operations, and Justice Fund
   */
  async distributePlatformFees(
    paymentIntentId: string,
    operationsAccountId: string,
    justiceAccountId: string
  ): Promise<{ operationsTransfer: Stripe.Transfer; justiceTransfer: Stripe.Transfer }> {
    // Retrieve the payment intent
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (!paymentIntent.metadata.ultimateFairSplit) {
      throw new Error('Payment was not processed with Ultimate Fair splitting')
    }

    const operationsAmount = parseFloat(paymentIntent.metadata.operationsShare || '0')
    const justiceAmount = parseFloat(paymentIntent.metadata.justiceShare || '0')
    
    const currency = paymentIntent.currency
    const multiplier = ['jpy', 'krw'].includes(currency) ? 1 : 100

    // Create transfers to Operations and Justice Fund accounts
    const operationsTransfer = await this.stripe.transfers.create({
      amount: Math.round(operationsAmount * multiplier),
      currency,
      destination: operationsAccountId,
      metadata: {
        paymentIntentId,
        purpose: 'operations_share',
        ultimateFairSplit: 'true'
      }
    })

    const justiceTransfer = await this.stripe.transfers.create({
      amount: Math.round(justiceAmount * multiplier),
      currency,
      destination: justiceAccountId,
      metadata: {
        paymentIntentId,
        purpose: 'justice_fund',
        ultimateFairSplit: 'true'
      }
    })

    return {
      operationsTransfer,
      justiceTransfer
    }
  }

  /**
   * Get split breakdown for display purposes
   */
  getSplitBreakdown(splits: PaymentSplit): {
    provider: { amount: number; percentage: number; description: string }
    platform: { amount: number; percentage: number; description: string }
    operations: { amount: number; percentage: number; description: string }
    justice: { amount: number; percentage: number; description: string }
  } {
    const total = splits.totalAmount

    return {
      provider: {
        amount: splits.providerAmount,
        percentage: Math.round((splits.providerAmount / total) * 100),
        description: 'Service provider earnings - the person doing the work'
      },
      platform: {
        amount: splits.platformAmount,
        percentage: Math.round((splits.platformAmount / total) * 100),
        description: 'Platform development and maintenance - building better tools'
      },
      operations: {
        amount: splits.operationsAmount,
        percentage: Math.round((splits.operationsAmount / total) * 100),
        description: 'Operations and infrastructure - keeping the lights on'
      },
      justice: {
        amount: splits.justiceAmount,
        percentage: Math.round((splits.justiceAmount / total) * 100),
        description: 'Justice Fund - supporting those who need help most'
      }
    }
  }

  /**
   * Answer 53 - Harmonized payment resolution
   * For complex payment scenarios requiring creative solutions
   */
  async resolvePaymentHarmonically(
    baseAmount: number,
    currency: string,
    scenario: 'partial_refund' | 'split_booking' | 'group_payment' | 'sliding_scale',
    parameters: Record<string, any>
  ): Promise<{ solution: string; splits: PaymentSplit[]; reasoning: string }> {
    const solutions: PaymentSplit[] = []
    let reasoning = ''

    switch (scenario) {
      case 'sliding_scale':
        // Adjust provider share based on client's ability to pay
        const clientCapacity = parameters.clientCapacity || 1.0 // 0.5 = 50% capacity
        const adjustedConfig = {
          ...this.defaultConfig,
          providerShare: Math.max(40, this.defaultConfig.providerShare * clientCapacity),
          justiceShare: Math.min(20, this.defaultConfig.justiceShare + (1 - clientCapacity) * 15)
        }
        
        solutions.push(this.calculateSplit(baseAmount, currency, adjustedConfig))
        reasoning = `Sliding scale applied based on client capacity (${Math.round(clientCapacity * 100)}%). Justice Fund increased to support accessibility.`
        break

      case 'group_payment':
        // Split payment among multiple participants
        const participants = parameters.participants || 1
        const perPersonAmount = baseAmount / participants
        
        for (let i = 0; i < participants; i++) {
          solutions.push(this.calculateSplit(perPersonAmount, currency))
        }
        reasoning = `Group payment split among ${participants} participants. Each pays ${perPersonAmount} ${currency.toUpperCase()}.`
        break

      case 'partial_refund':
        // Calculate refund with fair distribution
        const refundPercentage = parameters.refundPercentage || 0.5
        const refundAmount = baseAmount * refundPercentage
        const retainedAmount = baseAmount - refundAmount
        
        solutions.push(this.calculateSplit(retainedAmount, currency))
        reasoning = `Partial refund of ${Math.round(refundPercentage * 100)}%. Fair distribution maintained on retained amount.`
        break

      case 'split_booking':
        // Handle bookings with multiple service types
        const serviceTypes = parameters.serviceTypes || []
        
        serviceTypes.forEach((service: any) => {
          const serviceAmount = baseAmount * service.proportion
          solutions.push(this.calculateSplit(serviceAmount, currency, service.config))
        })
        reasoning = 'Multi-service booking with proportional Ultimate Fair splitting per service type.'
        break

      default:
        solutions.push(this.calculateSplit(baseAmount, currency))
        reasoning = 'Standard Ultimate Fair distribution applied.'
    }

    return {
      solution: "Creative change through compassion - payment harmonizes all stakeholders",
      splits: solutions,
      reasoning
    }
  }

  /**
   * Generate Ultimate Fair transparency report
   */
  generateTransparencyReport(splits: PaymentSplit[]): {
    totalProcessed: number
    providersEarned: number
    platformInvestment: number
    operationsSupport: number
    justiceImpact: number
    ecosystemHealth: string
  } {
    const totals = splits.reduce((acc, split) => ({
      total: acc.total + split.totalAmount,
      provider: acc.provider + split.providerAmount,
      platform: acc.platform + split.platformAmount,
      operations: acc.operations + split.operationsAmount,
      justice: acc.justice + split.justiceAmount
    }), { total: 0, provider: 0, platform: 0, operations: 0, justice: 0 })

    const healthScore = (totals.provider / totals.total) * 100
    let ecosystemHealth = 'Thriving'
    
    if (healthScore < 50) ecosystemHealth = 'Needs Attention'
    else if (healthScore < 55) ecosystemHealth = 'Growing'
    else if (healthScore > 65) ecosystemHealth = 'Abundant'

    return {
      totalProcessed: totals.total,
      providersEarned: totals.provider,
      platformInvestment: totals.platform,
      operationsSupport: totals.operations,
      justiceImpact: totals.justice,
      ecosystemHealth
    }
  }
}