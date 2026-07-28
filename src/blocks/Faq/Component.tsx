import React from 'react'

export type FaqProps = {
  heading?: string | null
  openFirst?: boolean | null
  items?: { question?: string | null; answer?: string | null; id?: string | null }[] | null
}

/**
 * ponytail: `<details>`/`<summary>` — the accordion the browser already ships.
 * No client component, no state, no JS bundle, and it is keyboard-accessible and
 * findable by ctrl-F without anyone having to remember to make it so.
 */
export const FaqBlock: React.FC<FaqProps> = ({ heading, openFirst, items }) => {
  const list = (items || []).filter((i) => i?.question && i?.answer)
  if (!list.length) return null

  // FAQPage structured data — this is what makes the questions expandable
  // directly in Google's results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  }

  return (
    <section className="container my-16">
      {heading && <h2 className="mb-8 text-center text-2xl font-bold">{heading}</h2>}

      <div className="mx-auto max-w-3xl divide-y divide-border rounded-lg border border-border">
        {list.map((item, i) => (
          <details
            key={item.id || i}
            open={openFirst !== false && i === 0}
            className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
              <span>{item.question}</span>
              {/* Rotating a plus into a cross needs no icon set and no state. */}
              <span
                aria-hidden="true"
                className="shrink-0 text-xl leading-none text-primary transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              {String(item.answer)
                .split(/\n{2,}/)
                .map((para, p) => (
                  <p key={p}>{para.trim()}</p>
                ))}
            </div>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  )
}
