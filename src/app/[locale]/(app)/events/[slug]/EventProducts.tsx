import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

/**
 * What is for sale at this event — and afterwards, what was.
 *
 * The tense is the whole point. Before the event this is a stall list; after it
 * the same rows are the record of what was on the table, which is exactly the
 * kind of thing someone comes back to a past event page looking for.
 *
 * `eventPrice` is in dollars, matching `Products.priceInUSD`, and is not a
 * discount engine — see the field comment on Events. When it undercuts the
 * normal price we show both, because a struck-through price is the only way a
 * reader can tell that the event price meant something.
 */

type Row = {
  product?:
    | {
        id?: number
        title?: string
        slug?: string
        priceInUSD?: number | null
        gallery?: Array<{ image?: { url?: string; alt?: string } | number | null }> | null
      }
    | number
    | null
  eventPrice?: number | null
  note?: string | null
}

const money = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`

const thumb = (p: Exclude<Row['product'], number | null | undefined>) => {
  const first = p.gallery?.[0]?.image
  return first && typeof first === 'object' && first.url ? first.url : null
}

export const EventProducts: React.FC<{ rows?: Row[] | null; isPast: boolean }> = ({
  rows,
  isPast,
}) => {
  // A row whose product was deleted survives as a null FK — skip it rather than
  // rendering an empty card.
  const usable = (rows || []).filter(
    (r): r is Row & { product: Exclude<Row['product'], number | null | undefined> } =>
      !!r.product && typeof r.product === 'object',
  )
  if (usable.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">
        {isPast ? 'What was on the table' : 'Available at this event'}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {usable.map((row, i) => {
          const p = row.product
          const src = thumb(p)
          const normal = typeof p.priceInUSD === 'number' ? p.priceInUSD : null
          const special = typeof row.eventPrice === 'number' ? row.eventPrice : null
          const isBetter = special != null && normal != null && special < normal

          const inner = (
            <>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {src && (
                  <Image src={src} alt={p.title || ''} fill sizes="64px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title}</p>
                {(special != null || normal != null) && (
                  <p className="text-sm">
                    {special != null ? (
                      <>
                        <span className="font-semibold">{money(special)}</span>
                        {isBetter && (
                          <span className="ml-2 text-muted-foreground line-through">
                            {money(normal!)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{money(normal!)}</span>
                    )}
                  </p>
                )}
                {row.note && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.note}</p>
                )}
              </div>
            </>
          )

          return (
            <li key={i}>
              {p.slug ? (
                <Link
                  href={`/products/${p.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  {inner}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
