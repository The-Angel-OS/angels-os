'use client'

import React, { useState, useCallback } from 'react'
import { ALL_FONTS as FONT_OPTIONS } from '@/config/brandingOptions'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Store,
  ShoppingBag,
  Palette,
  Calendar,
  Layers,
} from 'lucide-react'
import { validateTenantIdentity, provisionTenant, getDefaultPersonality } from './actions'
import type { WizardState } from './actions'
import type { EndeavorType } from '@/utilities/spaceProvisioning'
import { SPACE_TEMPLATES } from '@/utilities/spaceProvisioning'
import { useRouter } from 'next/navigation'

const STEPS = ['Identity', 'Endeavor', 'Branding', 'Nimue', 'Launch'] as const

const ENDEAVOR_ICONS: Record<EndeavorType, React.ReactNode> = {
  'service-provider': <Store size={24} />,
  'retail-commerce': <ShoppingBag size={24} />,
  'creator-content': <Palette size={24} />,
  'booking-based': <Calendar size={24} />,
  custom: <Layers size={24} />,
}

const DEFAULT_STATE: WizardState = {
  identity: { name: '', slug: '', domain: '' },
  endeavorType: 'retail-commerce',
  branding: {
    siteName: '',
    tagline: '',
    primaryColor: '#10B981',
    secondaryColor: '#0078D4',
    accentColor: '#FF6B35',
    headingFont: 'inter',
    bodyFont: 'inter',
  },
  nimue: {
    angelName: 'Nimue',
    personality: '',
    domainExpertise: '',
  },
}

export function ProvisionWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(DEFAULT_STATE)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    tenantSlug?: string
    error?: string
  } | null>(null)

  // Load default Nimue personality on first render
  React.useEffect(() => {
    getDefaultPersonality().then((p) =>
      setState((s) => ({ ...s, nimue: { ...s.nimue, personality: p } })),
    )
  }, [])

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const updateIdentity = useCallback(
    (field: string, value: string) => {
      setState((s) => {
        const identity = { ...s.identity, [field]: value }
        if (field === 'name') {
          identity.slug = generateSlug(value)
          identity.domain = `${identity.slug}.angel-os.app`
        }
        if (field === 'slug') {
          identity.domain = `${value}.angel-os.app`
        }
        return { ...s, identity, branding: { ...s.branding, siteName: s.branding.siteName || identity.name } }
      })
      setSlugError(null)
    },
    [],
  )

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return !!state.identity.name && !!state.identity.slug && !slugError
      case 1:
        return !!state.endeavorType
      case 2:
        return true // branding is optional
      case 3:
        return !!state.nimue.angelName
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = async () => {
    if (step === 0) {
      setIsValidating(true)
      const result = await validateTenantIdentity(state.identity.slug)
      setIsValidating(false)
      if (!result.valid) {
        setSlugError(result.error || 'Invalid slug')
        return
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleProvision = async () => {
    setIsProvisioning(true)
    const res = await provisionTenant(state)
    setResult(res)
    setIsProvisioning(false)
  }

  if (result?.success) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-green-200 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <Check size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-green-800 dark:text-green-200">
          Endeavor Launched!
        </h2>
        <p className="mb-1 text-sm text-green-700 dark:text-green-300">
          <strong>{state.identity.name}</strong> is live.
        </p>
        <p className="mb-6 text-xs text-green-600 dark:text-green-400">
          Tenant slug: {result.tenantSlug}
        </p>
        <button
          onClick={() => {
            // If tenant has a domain, navigate there; otherwise go to dashboard
            const domain = state.identity.domain
            if (domain && !domain.includes('localhost')) {
              window.location.href = `https://${domain}/dashboard`
            } else {
              router.push('/dashboard')
            }
          }}
          className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950">
        <h2 className="mb-2 text-lg font-bold text-red-800 dark:text-red-200">
          Provisioning Failed
        </h2>
        <p className="mb-4 text-sm text-red-700 dark:text-red-300">{result.error}</p>
        <button
          onClick={() => setResult(null)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i === step
                  ? 'bg-blue-600 text-white'
                  : i < step
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span
              className={`ml-2 hidden text-xs sm:inline ${
                i === step ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-px w-8 bg-border sm:w-12" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-lg border border-border bg-background p-6">
        {/* Step 1: Identity */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">What&apos;s your endeavor?</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={state.identity.name}
                onChange={(e) => updateIdentity('name', e.target.value)}
                placeholder="Hays Cactus Farm"
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <input
                type="text"
                value={state.identity.slug}
                onChange={(e) => updateIdentity('slug', e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {slugError && (
                <p className="mt-1 text-xs text-red-500">{slugError}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Domain</label>
              <input
                type="text"
                value={state.identity.domain}
                onChange={(e) => updateIdentity('domain', e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Custom domain can be configured later
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Endeavor Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">What kind of business?</h2>
            <p className="text-sm text-muted-foreground">
              This determines what channels and tools get set up for you.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                Object.entries(SPACE_TEMPLATES) as [EndeavorType, (typeof SPACE_TEMPLATES)[EndeavorType]][]
              ).map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() =>
                    setState((s) => ({ ...s, endeavorType: key }))
                  }
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                    state.endeavorType === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {ENDEAVOR_ICONS[key]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{tmpl.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {tmpl.examples}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {tmpl.channels.length} channels
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Branding */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Make it yours</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Site Name</label>
                <input
                  type="text"
                  value={state.branding.siteName}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      branding: { ...s.branding, siteName: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tagline</label>
                <input
                  type="text"
                  value={state.branding.tagline}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      branding: { ...s.branding, tagline: e.target.value },
                    }))
                  }
                  placeholder="Your tagline here"
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map(
                (colorKey) => (
                  <div key={colorKey}>
                    <label className="mb-1 block text-xs font-medium capitalize">
                      {colorKey.replace('Color', '')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={state.branding[colorKey]}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            branding: {
                              ...s.branding,
                              [colorKey]: e.target.value,
                            },
                          }))
                        }
                        className="h-8 w-8 cursor-pointer rounded border-0"
                      />
                      <span className="text-xs text-muted-foreground">
                        {state.branding[colorKey]}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['headingFont', 'bodyFont'] as const).map((fontKey) => (
                <div key={fontKey}>
                  <label className="mb-1 block text-sm font-medium capitalize">
                    {fontKey.replace('Font', ' Font')}
                  </label>
                  <select
                    value={state.branding[fontKey]}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        branding: { ...s.branding, [fontKey]: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {/* Preview card */}
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: state.branding.primaryColor,
                background: `linear-gradient(135deg, ${state.branding.primaryColor}10, ${state.branding.secondaryColor}10)`,
              }}
            >
              <div
                className="text-sm font-bold"
                style={{ color: state.branding.primaryColor }}
              >
                {state.branding.siteName || state.identity.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {state.branding.tagline || 'Your tagline will appear here'}
              </div>
              <div
                className="mt-2 inline-block rounded px-2 py-1 text-xs text-white"
                style={{ backgroundColor: state.branding.accentColor }}
              >
                Accent Button
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Nimue Config */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Configure your Angel</h2>
            <p className="text-sm text-muted-foreground">
              Your Angel knows everything about your endeavor and helps manage it.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Angel Name</label>
              <input
                type="text"
                value={state.nimue.angelName}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    nimue: { ...s.nimue, angelName: e.target.value },
                  }))
                }
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Personality</label>
              <textarea
                value={state.nimue.personality}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    nimue: { ...s.nimue, personality: e.target.value },
                  }))
                }
                rows={4}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Domain Expertise
              </label>
              <textarea
                value={state.nimue.domainExpertise}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    nimue: { ...s.nimue, domainExpertise: e.target.value },
                  }))
                }
                rows={2}
                placeholder="e.g., Expert in desert plants, cactus care, and sustainable farming practices..."
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                What should your Angel know about? This shapes how it helps customers.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review & Launch */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review &amp; Launch</h2>
            <div className="space-y-3 rounded-lg bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{state.identity.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-mono text-xs">{state.identity.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domain</span>
                <span className="text-xs">{state.identity.domain}</span>
              </div>
              <div className="border-t border-border pt-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">
                  {SPACE_TEMPLATES[state.endeavorType]?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channels</span>
                <span>
                  {SPACE_TEMPLATES[state.endeavorType]?.channels.length} channels
                </span>
              </div>
              <div className="border-t border-border pt-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Angel</span>
                <span className="font-medium">{state.nimue.angelName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branding</span>
                <div className="flex gap-1">
                  {[
                    state.branding.primaryColor,
                    state.branding.secondaryColor,
                    state.branding.accentColor,
                  ].map((c) => (
                    <div
                      key={c}
                      className="h-4 w-4 rounded-full border border-border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:invisible"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed() || isValidating}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isValidating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                Next
                <ArrowRight size={14} />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleProvision}
            disabled={isProvisioning}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProvisioning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <Check size={14} />
                Launch Endeavor
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
