'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Bot, Sparkles, Database, Search, ArrowRight, Play } from 'lucide-react'

export const LeoAiSection: React.FC = () => {
  return (
    <section id="leo-ai" className="relative w-full py-16 bg-zinc-950/40 border-y border-border/60 overflow-hidden scroll-mt-16">
      <div className="container relative z-10">
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          {/* Left Column: Copy & Value Proposition (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-4 w-fit">
              <Bot className="w-3.5 h-3.5" />
              Creator Vector RAG
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Your Very Own AI That Has Watched Every Second of Your Content
            </h2>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Paste your YouTube channel URL. In minutes, LEO ingests your entire back-catalog of videos, transcripts, and community posts into a live vector RAG index powered by Google Gemini and PostgreSQL pgvector.
            </p>

            {/* Feature highlights */}
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Play className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Exact Timestamp Video Deep Links</h4>
                  <p className="text-xs text-muted-foreground">
                    LEO doesn't hallucinate generic answers. It quotes your exact words and delivers clickable <span className="text-primary font-mono font-semibold">[MM:SS]</span> links straight into the video moment.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Database className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">11,480+ Chunks Already Live</h4>
                  <p className="text-xs text-muted-foreground">
                    Battle-tested on My Lunch Break (380 episodes, 6,941 chunks) and Clearwater Cruisin' (1,500+ videos, 4,539 chunks).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Search className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">24/7 Fan Engagement &amp; Support</h4>
                  <p className="text-xs text-muted-foreground">
                    Answers questions, recommends merch, assists with bookings, and handles customer inquiries even when you are asleep.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Link
                href="/start?focus=leo"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Auto-Index Your Channel
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right Column: Visual LEO RAG Demonstration (7 cols) */}
          <div className="lg:col-span-7 relative group overflow-hidden rounded-2xl border border-border/80 bg-zinc-950 p-2 shadow-2xl aspect-[16/10]">
            <Image
              src="/images/leo-ai-chat-preview.svg"
              alt="LEO 2.0 Vector RAG Live Demo"
              fill
              className="object-contain p-2 transition-transform duration-500 group-hover:scale-[1.02]"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}
