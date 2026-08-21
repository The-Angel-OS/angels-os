'use client'

import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

/**
 * Content-left hero — ONE full-bleed image with the copy over a dark gradient.
 *
 * The first cut of this was a hard 50/50 split: solid slab left, photo right.
 * Looking at Kessela's actual page, that's not what they do — they run a single
 * full-bleed photograph and fade it to near-black on the left, with the copy
 * sitting on the dark part. Same corporate read, and crucially it needs no
 * second asset: the image you already have does both jobs.
 *
 * On mobile the gradient goes vertical so the text has a dark bed underneath it
 * rather than competing with whatever happens to be on the left of the photo.
 */

/**
 * Mobile gradient (dark bed under the text) paired with the md+ horizontal one
 * (dark left third). Same shape at every level; only the alphas move.
 */
const SCRIMS: Record<string, string> = {
  strong:
    'bg-[linear-gradient(180deg,rgba(10,11,13,0.92)_0%,rgba(10,11,13,0.55)_60%,rgba(10,11,13,0.85)_100%)] md:bg-[linear-gradient(90deg,rgba(10,11,13,0.96)_0%,rgba(10,11,13,0.85)_38%,rgba(10,11,13,0.25)_65%,rgba(10,11,13,0.05)_100%)]',
  medium:
    'bg-[linear-gradient(180deg,rgba(10,11,13,0.72)_0%,rgba(10,11,13,0.35)_60%,rgba(10,11,13,0.6)_100%)] md:bg-[linear-gradient(90deg,rgba(10,11,13,0.78)_0%,rgba(10,11,13,0.55)_38%,rgba(10,11,13,0.12)_65%,rgba(10,11,13,0)_100%)]',
  light:
    'bg-[linear-gradient(180deg,rgba(10,11,13,0.45)_0%,rgba(10,11,13,0.18)_60%,rgba(10,11,13,0.35)_100%)] md:bg-[linear-gradient(90deg,rgba(10,11,13,0.5)_0%,rgba(10,11,13,0.28)_38%,rgba(10,11,13,0.05)_65%,rgba(10,11,13,0)_100%)]',
  // No element at all, rather than a transparent one: nothing to composite.
  none: '',
}

export const SplitPanelHero: React.FC<Page['hero']> = ({ links, media, richText, scrim }) => {
  // Unset means 'strong' — the only value that existed before the dial, so
  // every hero built before today renders exactly as it did.
  const scrimClass = SCRIMS[scrim || 'strong'] ?? SCRIMS.strong // see heros/scrim.ts for the levels
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
      {/* ── Full-bleed imagery ──────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {mediaObj && isVideo && mediaObj.url ? (
          <video
            className="h-full w-full object-cover"
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
            <Media fill imgClassName="object-cover" priority resource={media} size="100vw" />
          )
        )}
      </div>

      {/* Fade to near-black where the copy sits. Vertical on mobile (dark bed
          under the text), horizontal from md up (dark left third).

          Dialable, because the right amount depends on the image: a photograph
          needs a real bed under the heading, while an image that carries its
          own words — a poster, an infographic — just goes muddy under one.
          'strong' is the original, so every hero built before this is
          unchanged. */}
      {scrimClass && <div className={`pointer-events-none absolute inset-0 ${scrimClass}`} />}

      <div className="relative grid min-h-[70vh] grid-cols-1 md:grid-cols-2">
        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="flex items-center px-8 py-16 text-white md:px-14 lg:px-20">
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

        {/* Right column is intentionally empty — it's the breathing room that
            lets the photograph read, and it collapses on mobile. */}
        <div aria-hidden="true" />
      </div>
    </div>
  )
}
