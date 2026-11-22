'use client'

import React from 'react'
import { Address } from '@/payload-types'

type Props = {
  customerEmail?: string
  billingAddress?: Partial<Address>
  shippingAddress?: Partial<Address>
  setProcessingPayment: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Legacy CheckoutForm stub kept for backwards import compatibility.
 * Shop checkout now redirects through hosted Square / PayPal checkout via
 * POST /api/payment-ops/checkout in CheckoutPage.tsx.
 */
export const CheckoutForm: React.FC<Props> = () => {
  return null
}
