'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Product } from '@/payload-types'
import { MailIcon } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'

/**
 * "Contact seller / Email me about this" — captures name + email (+ phone, message)
 * and routes to the tenant's inbox via POST /api/contact-ops/seller (deliverLead).
 * For local-pickup / big-ticket fire-sale goods where a buyer wants to reach the
 * seller directly rather than run the full checkout.
 */
export function ContactSeller({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const tenantId = typeof product.tenant === 'object' ? product.tenant?.id : product.tenant

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') || '').trim()
    const email = String(data.get('email') || '').trim()

    if (!name || !email) {
      toast.error('Please enter your name and email.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/contact-ops/seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantId ?? undefined,
          name,
          email,
          phone: String(data.get('phone') || '').trim() || undefined,
          message: String(data.get('message') || '').trim() || undefined,
          productSlug: product.slug,
          productTitle: product.title,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || 'Could not send your message.')
      }
      toast.success("Sent! The seller will get back to you.")
      setOpen(false)
      form.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" type="button" aria-label="Contact the seller">
          <MailIcon className="mr-2 h-4 w-4" />
          Email me about this
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact the seller</DialogTitle>
          <DialogDescription>
            About <span className="font-medium">{product.title}</span>. Leave your details and
            the seller will get back to you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-name">Name</Label>
            <Input id="cs-name" name="name" required autoComplete="name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-email">Email</Label>
            <Input id="cs-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-phone">Phone (optional)</Label>
            <Input id="cs-phone" name="phone" type="tel" autoComplete="tel" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-message">Message</Label>
            <Textarea
              id="cs-message"
              name="message"
              rows={3}
              placeholder="Is this still available? I'd like to arrange pickup…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send message'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
