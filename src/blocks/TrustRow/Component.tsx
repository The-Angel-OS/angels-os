import React from 'react'

export type TrustRowProps = {
  heading?: string | null
  footnote?: string | null
  items?:
    | {
        icon?: string | null
        label?: string | null
        detail?: string | null
        id?: string | null
      }[]
    | null
}

/**
 * Inline SVG, not an icon dependency and not uploaded images.
 *
 * ponytail: seven glyphs cover every trust row anyone has ever asked for. A
 * lucide import for this would add a package and a client boundary; an upload
 * field would make the tenant go and find artwork before the row renders at all.
 * `currentColor` means the whole set inherits the tenant's brand colour for free.
 */
const ICONS: Record<string, React.ReactNode> = {
  shield: <path d="M12 2 4 5.5v6c0 5 3.4 9 8 10.5 4.6-1.5 8-5.5 8-10.5v-6L12 2Zm-1 13-3.5-3.5 1.4-1.4L11 12.2l4.1-4.1 1.4 1.4L11 15Z" />,
  rosette: <path d="M12 2a6 6 0 1 0 0 12A6 6 0 0 0 12 2Zm0 2.2 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3L7.2 7.7l3.3-.5L12 4.2ZM7.5 15.3 5 22l4.4-1.6L12 22l2.6-1.6L19 22l-2.5-6.7A8 8 0 0 1 12 16a8 8 0 0 1-4.5-.7Z" />,
  return: <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z" />,
  truck: <path d="M3 6h11v9H3V6Zm12 3h3.5L21 12v3h-6V9ZM6.5 20a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm11 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />,
  lock: <path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2Zm-8-2a3 3 0 0 1 6 0v2H9V7Zm4 8.7V18h-2v-2.3a2 2 0 1 1 2 0Z" />,
  support: <path d="M12 2a9 9 0 0 0-9 9v5a3 3 0 0 0 3 3h2v-8H5v0a7 7 0 0 1 14 0v0h-3v8h2a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-9Z" />,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1L12 2Z" />,
}

export const TrustRowBlock: React.FC<TrustRowProps> = ({ heading, footnote, items }) => {
  const list = (items || []).filter((i) => i?.label)
  if (!list.length) return null

  return (
    <section className="container my-12">
      {heading && <h2 className="mb-8 text-center text-2xl font-bold">{heading}</h2>}

      <ul className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
        {list.map((item, i) => (
          <li key={item.id || i} className="flex flex-col items-center text-center">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="mb-3 h-9 w-9"
              // The tenant's brand colour, emitted by TenantStyles. The same block
              // on another portal comes out that portal's colour with no edit.
              style={{ color: 'var(--tenant-primary, var(--primary))' }}
              fill="currentColor"
            >
              {ICONS[item.icon || 'shield'] ?? ICONS.shield}
            </svg>
            <span className="text-sm font-semibold uppercase tracking-wide">{item.label}</span>
            {item.detail && (
              <span className="mt-1 text-xs text-muted-foreground">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>

      {footnote && (
        <p className="mt-8 text-center text-xs text-muted-foreground">{footnote}</p>
      )}
    </section>
  )
}
