'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/providers/Auth'
import {
  Youtube,
  Globe,
  ShoppingBag,
  Users,
  MessageSquare,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'

export const StartPageClient: React.FC = () => {
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const initialHandle = searchParams.get('handle') || ''
  const initialYoutube = searchParams.get('youtube') || ''
  const initialFocus = searchParams.get('focus') || 'storefront'
  const initialPlan = searchParams.get('plan') || 'creator'
  const initialStep = Number(searchParams.get('step') || '0')

  const [step, setStep] = useState<1 | 2 | 3 | 4>(
    initialStep === 4 ? 4 : initialStep === 3 ? 3 : initialStep === 2 ? 2 : 1,
  )
  const [handle, setHandle] = useState(initialHandle)
  const [youtubeChannel, setYoutubeChannel] = useState(initialYoutube)
  const [portalTitle, setPortalTitle] = useState(searchParams.get('title') || '')
  const [portalTagline, setPortalTagline] = useState(searchParams.get('tagline') || '')
  const [selectedFocus, setSelectedFocus] = useState<string[]>(
    initialFocus ? [initialFocus, 'memberships'].filter((v, i, a) => a.indexOf(v) === i) : ['storefront', 'memberships'],
  )
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const [provisionResult, setProvisionResult] = useState<{
    slug: string
    url: string
    dashboardUrl: string
    upgradeHint?: string
  } | null>(null)

  useEffect(() => {
    if (initialHandle && !portalTitle) {
      setHandle(initialHandle)
      setPortalTitle(initialHandle.charAt(0).toUpperCase() + initialHandle.slice(1) + ' Universe')
      setPortalTagline((prev) => prev || 'Official Creator Storefront & Community')
      if (!initialStep) setStep(2)
    } else if (initialYoutube && !portalTitle) {
      setYoutubeChannel(initialYoutube)
      const cleanName = initialYoutube.replace(/[@/]/g, '').trim()
      setHandle(cleanName.toLowerCase().replace(/[^a-z0-9-]/g, ''))
      setPortalTitle(cleanName + ' Channel Portal')
      setPortalTagline((prev) => prev || 'Videos, Exclusive Merch & Community Spaces')
      if (!initialStep) setStep(2)
    }
  }, [initialHandle, initialYoutube, initialStep, portalTitle])

  const toggleFocus = (id: string) => {
    setSelectedFocus((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const buildResumeUrl = () => {
    const params = new URLSearchParams()
    if (handle) params.set('handle', handle)
    if (youtubeChannel) params.set('youtube', youtubeChannel)
    if (portalTitle) params.set('title', portalTitle)
    if (portalTagline) params.set('tagline', portalTagline)
    if (selectedPlan) params.set('plan', selectedPlan)
    params.set('step', '4')
    return `/start?${params.toString()}`
  }

  const handleLaunch = async () => {
    setProvisionError(null)
    setIsProvisioning(true)

    try {
      const res = await fetch('/api/portal-ops/self-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          handle,
          name: portalTitle,
          tagline: portalTagline,
          youtubeChannel,
          focus: selectedFocus,
          plan: selectedPlan,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setProvisionError(data?.error || `Could not provision portal (HTTP ${res.status}).`)
        return
      }
      setProvisionResult({
        slug: data.slug,
        url: data.url,
        dashboardUrl: data.dashboardUrl || `${data.url}/dashboard`,
        upgradeHint: data.upgradeHint,
      })
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : 'Network error — please try again.')
    } finally {
      setIsProvisioning(false)
    }
  }

  const focusOptions = [
    {
      id: 'storefront',
      icon: ShoppingBag,
      title: 'Creator Merch & Digital Store',
      desc: 'Sell Print-on-Demand tees, hoodies, and digital downloads with zero inventory risk.',
    },
    {
      id: 'memberships',
      icon: Users,
      title: 'Paid Memberships & Tiers',
      desc: 'Patreon-style monthly recurring subscriptions with exclusive content gates.',
    },
    {
      id: 'spaces',
      icon: MessageSquare,
      title: 'Community Spaces & Chat',
      desc: 'Discord-style threaded chat rooms and live voice channels on your domain.',
    },
    {
      id: 'events',
      icon: Calendar,
      title: 'Paid Events & 1-on-1 Bookings',
      desc: 'Square-powered event tickets and automated appointment booking calendar.',
    },
  ]

  return (
    <div className="min-h-screen py-16 bg-gradient-to-b from-background via-card/30 to-background text-foreground">
      <div className="container max-w-3xl">
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : step > s
                      ? 'bg-emerald-500 text-black'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Step {step} of 4 — {step === 1 ? 'Claim Identity' : step === 2 ? 'Branding Preview' : step === 3 ? 'Choose Pillars' : 'Confirm & Launch'}
          </span>
        </div>

        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8 shadow-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
              <Globe className="w-3.5 h-3.5" />
              60-Second Creator Onboarding
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              What Is Your Creator Handle or Channel?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your handle reserves your free instant subdomain (e.g. <span className="font-mono text-primary">yourname.spacesangels.com</span>). You can bind your own custom domain later in Settings.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Preferred Portal Handle
                </label>
                <div className="flex items-center rounded-xl border border-border bg-background px-4 py-3 focus-within:border-primary">
                  <span className="text-sm font-semibold text-muted-foreground select-none">
                    spacesangels.com/
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="yourhandle"
                    className="w-full bg-transparent border-0 text-sm font-bold text-foreground focus:outline-none pl-1"
                  />
                </div>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-xs font-semibold text-muted-foreground uppercase">
                  Or Auto-Import from YouTube
                </span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  YouTube Channel URL or @Handle
                </label>
                <div className="flex items-center rounded-xl border border-border bg-background px-4 py-3 focus-within:border-primary">
                  <Youtube className="w-4 h-4 text-red-500 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={youtubeChannel}
                    onChange={(e) => setYoutubeChannel(e.target.value)}
                    placeholder="https://youtube.com/@YourChannel"
                    className="w-full bg-transparent border-0 text-sm font-bold text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!handle && !youtubeChannel}
                onClick={() => {
                  if (youtubeChannel && !handle) {
                    const clean = youtubeChannel.replace(/[@/]/g, '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
                    setHandle(clean)
                    setPortalTitle(clean.charAt(0).toUpperCase() + clean.slice(1) + ' Universe')
                  } else if (handle && !portalTitle) {
                    setPortalTitle(handle.charAt(0).toUpperCase() + handle.slice(1) + ' Universe')
                  }
                  setPortalTagline('Official Storefront, Memberships & Community')
                  setStep(2)
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                Continue to Preview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: BRANDING PREVIEW */}
        {step === 2 && (
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8 shadow-xl">
            <h2 className="text-2xl font-extrabold text-foreground">
              Configure Your Portal Branding
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review your portal details. You can customize colors, banners, and logos anytime from Creator Studio.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Portal Name
                </label>
                <input
                  type="text"
                  value={portalTitle}
                  onChange={(e) => setPortalTitle(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Tagline / Bio
                </label>
                <input
                  type="text"
                  value={portalTagline}
                  onChange={(e) => setPortalTagline(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Live Preview Card */}
              <div className="mt-6 rounded-xl border border-border/80 bg-zinc-950 p-5 shadow-inner">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Live Subdomain Preview
                </span>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-lg font-black text-white shrink-0 shadow">
                    {portalTitle ? portalTitle.charAt(0) : 'A'}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{portalTitle || 'Your Portal'}</h4>
                    <p className="text-xs text-primary font-mono">{handle}.spacesangels.com</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{portalTagline}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Choose Monetization Pillars
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVENUE PILLARS */}
        {step === 3 && (
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8 shadow-xl">
            <h2 className="text-2xl font-extrabold text-foreground">
              Select What You Want to Launch Today
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select the features you want active on your portal. You can toggle any of these on or off later.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {focusOptions.map((opt) => {
                const Icon = opt.icon
                const isSelected = selectedFocus.includes(opt.id)
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleFocus(opt.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/60 bg-background/50 hover:bg-muted/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-foreground">{opt.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                Choose Your Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PLAN & LAUNCH */}
        {step === 4 && (
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8 shadow-xl">
            {provisionResult ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  Your Portal Is Live!
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Your creator portal is provisioned and reachable at{' '}
                  <a
                    href={provisionResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary font-bold underline"
                  >
                    {provisionResult.slug}.spacesangels.com
                  </a>
                  . Head into Creator Studio to customize your storefront, connect Square/PayPal, or upgrade your plan.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href={provisionResult.dashboardUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all w-full sm:w-auto"
                  >
                    Enter Creator Studio
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href={provisionResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-all w-full sm:w-auto"
                  >
                    View Live Site
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {provisionResult.upgradeHint && (
                    <a
                      href={provisionResult.upgradeHint}
                      className="inline-flex items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/20 transition-all w-full sm:w-auto"
                    >
                      Activate Creator Plan ($10/mo)
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-extrabold text-foreground">
                  Select Your Plan to Launch
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try the $0 Starter preview with zero commitment, or launch on the flagship Creator tier ($10/mo + 4% — activated in Studio after preview).
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {/* Starter Tier */}
                  <div
                    onClick={() => setSelectedPlan('starter')}
                    className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                      selectedPlan === 'starter'
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                        : 'border-border/60 bg-background/50 hover:bg-muted/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base font-bold text-foreground">Starter (Preview)</h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Free
                        </span>
                      </div>
                      <div className="text-2xl font-black text-foreground mb-1">$0<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                      <p className="text-xs font-bold text-primary mb-3">5% platform fee</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li>• Instant {handle || 'handle'}.spacesangels.com</li>
                        <li>• Public video &amp; post mirror</li>
                        <li>• Basic LEO AI demo</li>
                      </ul>
                    </div>
                  </div>

                  {/* Creator Tier */}
                  <div
                    onClick={() => setSelectedPlan('creator')}
                    className={`cursor-pointer rounded-xl border-2 p-5 transition-all flex flex-col justify-between relative ${
                      selectedPlan === 'creator'
                        ? 'border-primary bg-primary/15 shadow-lg ring-2 ring-primary/30'
                        : 'border-border bg-background/60 hover:border-primary/50'
                    }`}
                  >
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
                      Flagship
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base font-bold text-foreground">Creator Plan</h4>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          Most Popular
                        </span>
                      </div>
                      <div className="text-2xl font-black text-foreground mb-1">$10<span className="text-xs font-normal text-muted-foreground">/mo ($99/yr)</span></div>
                      <p className="text-xs font-bold text-primary mb-3">4% platform fee (Half of Patreon!)</p>
                      <ul className="space-y-1.5 text-xs text-foreground/90">
                        <li>• Paid Memberships &amp; Tier gates</li>
                        <li>• Creator Storefront &amp; POD Merch</li>
                        <li>• Community Spaces &amp; Chat</li>
                        <li>• LEO AI trained on your YouTube catalog</li>
                        <li>• Custom domain (yourname.com)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {!user && (
                  <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                    <p className="font-semibold text-foreground">
                      Sign in or create a free Angel OS account to claim{' '}
                      <span className="font-mono text-primary">{handle || 'yourhandle'}.spacesangels.com</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We will bring you right back to this exact step after authentication.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/login?redirect=${encodeURIComponent(buildResumeUrl())}`}
                        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        Sign in to Launch
                      </Link>
                      <Link
                        href={`/create-account?redirect=${encodeURIComponent(buildResumeUrl())}`}
                        className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        Create Free Account
                      </Link>
                    </div>
                  </div>
                )}

                {provisionError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{provisionError}</span>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={isProvisioning}
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  {user && (
                    <button
                      type="button"
                      disabled={isProvisioning || !handle}
                      onClick={handleLaunch}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isProvisioning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Provisioning Portal &amp; Spaces...
                        </>
                      ) : (
                        <>
                          Launch Your Universe Now
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
