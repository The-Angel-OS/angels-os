'use client'

import React, { useState } from 'react'
import {
  Globe,
  Lock,
  Users,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Wrench,
  ShoppingCart,
  Video,
  Calendar,
  Layers,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ── Types ─────────────────────────────────────────────────────────────────

type Visibility = 'public' | 'invite_only' | 'private'
type Template = 'service-provider' | 'retail-commerce' | 'creator-content' | 'booking-based' | 'custom'

interface InviteRow {
  email: string
  role: 'member' | 'moderator' | 'guest'
}

interface CreateSpaceDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (spaceId: string) => void
}

// ── Step data ─────────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string; Icon: React.ElementType }[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone in this Enterprise can find and join',
    Icon: Globe,
  },
  {
    value: 'invite_only',
    label: 'Invite-only',
    description: 'Members join by invitation link or direct invite',
    Icon: Users,
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Hidden — only visible to existing members',
    Icon: Lock,
  },
]

const TEMPLATE_OPTIONS: { value: Template; label: string; description: string; examples: string; Icon: React.ElementType }[] = [
  {
    value: 'service-provider',
    label: 'Service Provider',
    description: 'Bookings, client requests, portfolio, reviews',
    examples: 'Massage, consulting, cleaning, pressure washing',
    Icon: Wrench,
  },
  {
    value: 'retail-commerce',
    label: 'Retail & Commerce',
    description: 'Products, orders, support, catalog',
    examples: 'Cactus farm, exotic birds, equipment shop',
    Icon: ShoppingCart,
  },
  {
    value: 'creator-content',
    label: 'Creator & Content',
    description: 'Community, content updates, premium access',
    examples: 'Tours, coaching, online courses',
    Icon: Video,
  },
  {
    value: 'booking-based',
    label: 'Booking & Scheduling',
    description: 'Scheduling, consultations, availability',
    examples: 'Interview scheduling, booth rentals, salons',
    Icon: Calendar,
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Start with general + announcements, add channels as needed',
    examples: 'Anything else — build it your way',
    Icon: Layers,
  },
]

const STEP_LABELS = ['Info', 'Visibility', 'Template', 'Invite']

// ── Component ─────────────────────────────────────────────────────────────

export function CreateSpaceDialog({ open, onClose, onCreated }: CreateSpaceDialogProps) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('invite_only')
  const [template, setTemplate] = useState<Template>('custom')
  const [invites, setInvites] = useState<InviteRow[]>([{ email: '', role: 'member' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setStep(0)
    setName('')
    setDescription('')
    setVisibility('invite_only')
    setTemplate('custom')
    setInvites([{ email: '', role: 'member' }])
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 0
    return true
  }

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const addInviteRow = () => {
    setInvites([...invites, { email: '', role: 'member' }])
  }

  const updateInviteRow = (i: number, field: keyof InviteRow, value: string) => {
    const next = [...invites]
    next[i] = { ...next[i], [field]: value }
    setInvites(next)
  }

  const removeInviteRow = (i: number) => {
    setInvites(invites.filter((_, idx) => idx !== i))
  }

  const handleCreate = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const validInvites = invites.filter((r) => r.email.trim())
      const res = await fetch('/api/space-ops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          template,
          invites: validInvites,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create space')
        return
      }
      reset()
      onCreated(String(data.space.id))
    } catch {
      setError('Network error — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Create a Space</DialogTitle>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                    i === step
                      ? 'bg-primary text-primary-foreground'
                      : i < step
                        ? 'bg-primary/30 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px flex-1 ${i < step ? 'bg-primary/30' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 0: Name & Description ── */}
        {step === 0 && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Space name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canAdvance() && handleNext()}
                placeholder="My Awesome Space"
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this space for?"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ── Step 1: Visibility ── */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Who can see and join this space?</p>
            {VISIBILITY_OPTIONS.map(({ value, label, description: desc, Icon }) => (
              <button
                key={value}
                onClick={() => setVisibility(value)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  visibility === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                }`}
              >
                <Icon
                  size={18}
                  className={`mt-0.5 shrink-0 ${visibility === value ? 'text-primary' : 'text-muted-foreground'}`}
                />
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${visibility === value ? 'text-foreground' : 'text-foreground'}`}>
                    {label}
                  </div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <div
                  className={`ml-auto mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                    visibility === value ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {/* ── Step 2: Template ── */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pick a template to pre-create useful channels, or start custom.
            </p>
            <div className="grid gap-2">
              {TEMPLATE_OPTIONS.map(({ value, label, description: desc, examples, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTemplate(value)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    template === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`mt-0.5 shrink-0 ${template === value ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/70 italic">{examples}</div>
                  </div>
                  <div
                    className={`ml-auto mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                      template === value ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Invite Members ── */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Invite people by email. You can skip this and invite later.
            </p>
            <div className="space-y-2">
              {invites.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateInviteRow(i, 'email', e.target.value)}
                    placeholder="email@example.com"
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <select
                    value={row.role}
                    onChange={(e) => updateInviteRow(i, 'role', e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="guest">Guest</option>
                  </select>
                  {invites.length > 1 && (
                    <button
                      onClick={() => removeInviteRow(i)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addInviteRow}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={12} />
              Add another
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={step === 0 ? handleClose : handleBack}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            {step === 0 ? 'Cancel' : (
              <span className="flex items-center gap-1"><ChevronLeft size={14} /> Back</span>
            )}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Space'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
