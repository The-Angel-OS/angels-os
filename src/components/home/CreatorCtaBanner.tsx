'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles, Youtube, Check } from 'lucide-react'

export const CreatorCtaBanner: React.FC = () => {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [mode, setMode] = useState<'handle' | 'youtube'>('handle')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = handle.trim().replace(/^@/, '')
    if (!clean) return
    if (mode === 'youtube') {
      router.push(`/start?youtube=${encodeURIComponent(clean)}`)
    } else {
      router.push(`/start?handle=${encodeURIComponent(clean.toLowerCase().replace(/[^a-z0-9-]/g, ''))}`)
    }
  }

  return (
    <section className="relative w-full py-20 overflow-hidden bg-gradient-to-b from-transparent via-primary/5 to-primary/10 border-t border-border/80">
      <div className="container relative z-10 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Ready in 60 Seconds
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Build Your Universe. Own Your Community. Monetize Your Work.
        </h2>

        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Claim your handle now. Launch your storefront, memberships, real-time chat, and LEO AI archive today — with zero upfront cost or inventory.
        </p>

        {/* Dynamic Handle / YouTube Input Form */}
        <div className="mt-8 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 rounded-xl p-2 bg-card/80 backdrop-blur-md border border-border shadow-2xl">
            <div className="flex-1 flex items-center px-3 gap-2">
              <span className="text-sm font-bold text-muted-foreground select-none shrink-0">
                {mode === 'handle' ? 'spacesangels.com/' : 'YouTube:'}
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={mode === 'handle' ? 'yourhandle' : '@YourChannel or URL'}
                className="w-full bg-transparent border-0 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all shrink-0"
            >
              Start Free Preview
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle between Handle and YouTube */}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => { setMode('handle'); setHandle('') }}
              className={`hover:text-foreground transition-colors ${mode === 'handle' ? 'font-bold text-primary underline' : ''}`}
            >
              Claim Custom Subdomain
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => { setMode('youtube'); setHandle('') }}
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${mode === 'youtube' ? 'font-bold text-primary underline' : ''}`}
            >
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              Auto-Import from YouTube
            </button>
          </div>
        </div>

        {/* Trust Points */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-500" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-500" />
            Zero upfront inventory
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-500" />
            Keep 100% data ownership
          </span>
        </div>
      </div>
    </section>
  )
}
