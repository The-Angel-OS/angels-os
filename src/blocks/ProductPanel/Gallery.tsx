'use client'

import React, { useRef, useState } from 'react'

import { Media } from '@/components/Media'

type MediaDoc = { url?: string | null; alt?: string | null }

/**
 * Gallery with a lightbox.
 *
 * ponytail: the browser's own `<dialog>`. `showModal()` gives a real modal for
 * free — backdrop, Escape to close, focus trapped, inert page behind — all of
 * which a hand-rolled overlay gets wrong and then gets bug reports about. The
 * only state here is which image is selected.
 *
 * No carousel library. A product with four photographs does not need one, and
 * the thumbnail strip is a better interface than swiping past pictures you
 * cannot see.
 */
export const ProductGallery: React.FC<{ images: MediaDoc[]; alt: string }> = ({ images, alt }) => {
  const [active, setActive] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)

  const current = images[active]
  if (!current) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        // zoom-in tells someone the image does something before they click it.
        className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl border border-border bg-white"
        aria-label="Open larger image"
      >
        <Media fill imgClassName="object-contain p-2" resource={current as never} size="50vw" />
      </button>

      {images.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={`relative block h-20 w-20 overflow-hidden rounded-lg border-2 bg-white transition ${
                  i === active ? 'border-primary' : 'border-border hover:border-primary/50'
                }`}
              >
                <Media fill imgClassName="object-contain p-1" resource={img as never} size="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        // Click the backdrop to close. The dialog element IS the backdrop target,
        // so a click landing on the element itself (not its child) means outside.
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close()
        }}
        className="max-h-[92vh] max-w-[92vw] rounded-xl bg-white p-0 backdrop:bg-black/70"
      >
        <div className="relative">
          {current.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt || alt}
              className="max-h-[88vh] max-w-[88vw] object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-lg leading-none text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </dialog>
    </div>
  )
}
