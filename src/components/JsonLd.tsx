import React from 'react'
import type { JsonLdObject } from '@/utilities/structuredData'

/**
 * Renders one or more JSON-LD graphs as <script type="application/ld+json">.
 *
 * Nulls are filtered out, so a caller can pass every builder's result straight
 * through without guarding each one — the builders return null precisely so
 * this component can decide whether there is anything to emit.
 *
 * `dangerouslySetInnerHTML` is the only way React will emit an unescaped script
 * body, and it is safe here because the content is always JSON.stringify of an
 * object we built, never a raw string from a document. `</` is still escaped,
 * because a title containing `</script>` would otherwise close the tag early —
 * the one genuine injection vector in a JSON-LD block.
 */
export function JsonLd({ data }: { data: Array<JsonLdObject | null> | JsonLdObject | null }) {
  const graphs = (Array.isArray(data) ? data : [data]).filter(Boolean) as JsonLdObject[]
  if (!graphs.length) return null
  return (
    <>
      {graphs.map((g, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(g).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  )
}
