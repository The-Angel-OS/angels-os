'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface CancelConfirmDialogProps {
  orderId: number
  orderItemIndex: number
  angelTokenId?: string | null
  locale: string
  children: React.ReactNode
}

/**
 * CancelConfirmDialog — Confirmation dialog for cancelling an Angel Token.
 *
 * Shown when the customer clicks "Cancel & Refund" on a queued order.
 * POSTs to /api/order-ops/cancel, then redirects back to the order list.
 *
 * Sprint 39
 */
export function CancelConfirmDialog({
  orderId,
  orderItemIndex,
  angelTokenId,
  locale,
  children,
}: CancelConfirmDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/order-ops/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderItemIndex }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to cancel order.')
        setLoading(false)
        return
      }

      toast.success(data.message || 'Order cancelled. Refund issued.')
      setOpen(false)
      // Navigate back to order list so the updated status is shown
      router.push(`/${locale}/dashboard/my-orders`)
      router.refresh()
    } catch {
      toast.error('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Cancel this order?</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {angelTokenId && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-xs font-mono text-amber-700 dark:text-amber-300 uppercase tracking-widest mb-1">
                Angel Token
              </p>
              <p className="font-mono text-sm font-semibold text-amber-900 dark:text-amber-100">
                {angelTokenId}
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Cancelling this order will release the maker slot and issue a full refund to your
            original payment method. Please allow 5–10 business days for the refund to appear.
          </p>

          <p className="text-sm font-medium text-destructive">
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Keep Order
            </button>
          </DialogClose>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Cancelling…
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
