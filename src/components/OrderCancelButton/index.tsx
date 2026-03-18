'use client'

/**
 * Order Cancel Button — Customer-Initiated Cancellation
 *
 * Renders a cancel button on the order detail page for items still in
 * pending_match status (queued Angel Tokens). Calls POST /api/order-ops/cancel
 * with orderId and orderItemIndex.
 *
 * Only shows for orders that have cancellable fulfillment entries.
 *
 * @see src/endpoints/order-cancel.ts — backend handler
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface OrderCancelButtonProps {
  orderId: number | string
  orderItemIndex: number
  angelTokenId?: string
  className?: string
}

export const OrderCancelButton: React.FC<OrderCancelButtonProps> = ({
  orderId,
  orderItemIndex,
  angelTokenId,
  className,
}) => {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState('')

  const handleCancel = async () => {
    if (state === 'idle') {
      setState('confirming')
      return
    }

    if (state === 'confirming') {
      setState('loading')
      try {
        const res = await fetch('/api/order-ops/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, orderItemIndex }),
        })

        const data = await res.json()

        if (res.ok && data.success) {
          setState('success')
          setMessage(data.message || 'Order cancelled. Refund issued.')
        } else {
          setState('error')
          setMessage(data.error || 'Failed to cancel order.')
        }
      } catch {
        setState('error')
        setMessage('Network error — please try again.')
      }
    }
  }

  if (state === 'success') {
    return (
      <div className={className}>
        <p className="text-sm text-green-600 font-mono">{message}</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className={className}>
        <p className="text-sm text-red-500 font-mono mb-2">{message}</p>
        <Button variant="outline" size="sm" onClick={() => setState('idle')}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className={className}>
      {state === 'confirming' && (
        <p className="text-sm text-amber-600 font-mono mb-2">
          Are you sure? This will cancel{angelTokenId ? ` Angel Token ${angelTokenId}` : ' this item'} and
          issue a refund.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant={state === 'confirming' ? 'destructive' : 'outline'}
          size="sm"
          onClick={handleCancel}
          disabled={state === 'loading'}
        >
          {state === 'loading'
            ? 'Cancelling...'
            : state === 'confirming'
              ? 'Yes, cancel & refund'
              : 'Cancel order'}
        </Button>
        {state === 'confirming' && (
          <Button variant="ghost" size="sm" onClick={() => setState('idle')}>
            Keep order
          </Button>
        )}
      </div>
    </div>
  )
}
