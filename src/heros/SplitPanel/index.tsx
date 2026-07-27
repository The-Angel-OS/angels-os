'use client'

import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

/**
 * Split-panel hero — a solid colour panel beside a full-bleed photograph.
 *
 * Built to match the corporate-product pattern Kessela and most Avada/Divi
 * product sites use: content left on a dark slab, imagery right, a coloured
 * accent rule under the headline. It reads as "a company" in a way a centred
 * headline over a washed-out photo does not — which matters when the person
 * evaluating you is judging on appearance in the first three seconds.
 *
 * Stacks on mobile: panel first, image beneath, so the headline is never
 * competing with a face for the top of a phone screen.
 */
export const SplitPanelHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  const mediaObj =
    media && typeof media === 'object'
      ? (media as { mimeType?: string | null; url?: string | null })
      : null
  const isVideo = !!mediaObj?.mimeType?.startsWith('video/')

  // z-0 + isolate on the root: the header is `relative z-20` and its dropdown
  // is absolute INSIDE that context, so without an explicit z here the hero's
  // positioned children painted over the open menu. Pinning the hero into its
  // own stacking context below the header fixes it without raising the header
  // globally — which would risk covering modals on every other portal.
  return (
    <div className="relative isolate z-0 w-full" data-theme="dark">
      <div className="grid min-h-[70vh] grid-cols-1 md:grid-cols-2">
        {/* ── Content panel ────────────────────────────────────────────── */}
        <div className="flex items-center bg-[#111214] px-8 py-16 text-white md:px-14 lg:px-20">
          <div className="w-full max-w-xl">
            {richText && (
              <RichText
                className="[&_p:first-child]:text-4xl [&_p:first-child]:md:text-5xl [&_p:first-child]:lg:text-6xl [&_p:first-child]:font-bold [&_p:first-child]:tracking-tight [&_p:first-child]:leading-[1.02] [&_p:first-child]:mb-6 [&_p:not(:first-child)]:text-base [&_p:not(:first-child)]:md:text-lg [&_p:not(:first-child)]:text-white/70 [&_p:not(:first-child)]:leading-relaxed"
                data={richText}
                enableGutter={false}
              />
            )}

            {/* The accent squiggle. Theirs sits between headline and body and is
                the single most recognisable mark on the page — cheap to render,
                and its absence is what made ours look generic. Colour comes from
                the tenant's primary via CSS var, falling back to the coral. */}
            <svg
              className="my-6 h-4 w-28"
              viewBox="0 0 112 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 12 L16 4 L30 12 L44 4 L58 12 L72 4 L86 12 L100 4 L110 10"
                stroke="var(--tenant-primary, #F0524A)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Coral pills, scoped HERE rather than by changing the global
                Button variants — the accent belongs to this tenant, and
                restyling every portal's buttons to match one client is exactly
                the sort of change that breaks four other sites. First link is
                the solid CTA, the rest are ghost buttons. */}
            {Array.isArray(links) && links.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-3">
                {links.map(({ link }, i) => (
                  <li
                    key={i}
                    className={
                      i === 0
                        ? '[&_a]:!bg-[var(--tenant-primary,#F0524A)] [&_a]:!text-white [&_a]:!border-transparent [&_a]:!rounded-full [&_a]:!px-7 [&_a]:!py-2.5 [&_a]:!font-semibold [&_a]:!no-underline hover:[&_a]:!opacity-90'
                        : '[&_a]:!bg-transparent [&_a]:!text-white [&_a]:!border [&_a]:!border-white/35 [&_a]:!rounded-full [&_a]:!px-7 [&_a]:!py-2.5 [&_a]:!font-semibold [&_a]:!no-underline hover:[&_a]:!border-white'
                    }
                  >
                    <CMSLink {...link} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Imagery ──────────────────────────────────────────────────── */}
        <div className="relative min-h-[45vh] md:min-h-full">
          {mediaObj && isVideo && mediaObj.url ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={mediaObj.url}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            media &&
            typeof media === 'object' && (
              <Media fill imgClassName="object-cover" priority resource={media} size="50vw" />
            )
          )}
        </div>
      </div>
    </div>
  )
}
