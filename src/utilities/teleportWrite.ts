/**
 * teleportWrite — the write side of the Teleport primitive (content-only v1).
 *
 * Given a source tenant's exported graph (from /api/export-site) and THIS node's
 * `payload`, create a fresh tenant here and re-plant its real CONTENT — remapping
 * every media/page reference to the new ids. System infrastructure (spaces,
 * channels, messages, memberships) is deliberately NOT copied: a new tenant
 * re-provisions its own via the tenant afterChange hooks, so copying them would
 * duplicate. Chat history is dropped by design (Teleport v1).
 *
 * Media: copied as ROWS via payload.db.create — NO re-upload. Both nodes share
 * the Vercel Blob account and media urls are regenerated from `filename` on read,
 * so the source's binaries (already in the shared store) resolve on the new host.
 *
 * Safety: fail-soft per item (one bad row records an 'error' step, never throws);
 * only ever CREATES on this node; never touches the source. Dry-run is handled by
 * the caller — this runs only on execute.
 */

import type { Payload } from 'payload'

type Doc = Record<string, unknown>
type IdMap = Map<string | number, string | number>

export interface TeleportStep {
  collection: string
  attempted: number
  created: number
  errors: number
  notes?: string[]
}

export interface TeleportWriteResult {
  targetTenantId?: string | number
  targetSlug: string
  targetDomain: string
  steps: TeleportStep[]
  warnings: string[]
}

export interface TeleportWriteInput {
  data: Record<string, Doc[]>
  sourceTenant: Doc
  targetSlug: string
  targetDomain: string
}

/** Field names that hold a media/upload relationship anywhere in a doc. Remapped via mediaMap. */
const MEDIA_FIELD_NAMES = new Set([
  'media',
  'image',
  'logo',
  'favicon',
  'coverImage',
  'cadFile',
  'background',
  'backgroundImage',
  'icon',
  'thumbnail',
  'ogImage',
])

/** Extract a plain id from a relationship value (id | { id } | { value }). */
function relId(value: unknown): string | number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v.id === 'number' || typeof v.id === 'string') return v.id
    if (typeof v.value === 'number' || typeof v.value === 'string') return v.value
  }
  return undefined
}

/**
 * Deep-remap a value in place-ish (returns a new value):
 *  - any field whose KEY is in MEDIA_FIELD_NAMES and holds a relationship id → mediaMap
 *  - Lexical `upload` nodes (type:'upload', value:{id}|id) → mediaMap
 *  - Lexical internal `link`/`relationship` nodes pointing at pages → pageMap
 * Everything else is copied untouched (no blind "any number == id" replacement).
 */
function deepRemap(
  value: unknown,
  key: string | undefined,
  mediaMap: IdMap,
  pageMap: IdMap,
): unknown {
  // Media by field-name
  if (key && MEDIA_FIELD_NAMES.has(key)) {
    const id = relId(value)
    if (id != null && mediaMap.has(id)) return mediaMap.get(id)
    // leave as-is if unmapped (may be a non-relationship value with a colliding name)
  }

  if (Array.isArray(value)) {
    return value.map((v) => deepRemap(v, key, mediaMap, pageMap))
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>

    // Lexical upload node
    if (obj.type === 'upload' && (obj.relationTo === 'media' || obj.value != null)) {
      const id = relId(obj.value)
      if (id != null && mediaMap.has(id)) {
        return { ...obj, value: mediaMap.get(id) }
      }
    }
    // Lexical internal doc link to a page
    if (
      (obj.type === 'link' || obj.type === 'relationship') &&
      obj.relationTo === 'pages'
    ) {
      const id = relId(obj.value ?? (obj.fields as Doc | undefined)?.doc)
      if (id != null && pageMap.has(id)) {
        return { ...obj, value: pageMap.get(id) }
      }
    }

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deepRemap(v, k, mediaMap, pageMap)
    }
    return out
  }

  return value
}

/** Strip fields Payload manages / that must not carry across instances. */
function stripSystemFields(doc: Doc): Doc {
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    // virtuals regenerated on read by the storage adapter:
    url: _url,
    thumbnailURL: _t,
    ...rest
  } = doc
  return rest
}

export async function teleportWrite(
  payload: Payload,
  input: TeleportWriteInput,
): Promise<TeleportWriteResult> {
  const { data, sourceTenant, targetSlug, targetDomain } = input
  const result: TeleportWriteResult = {
    targetSlug,
    targetDomain,
    steps: [],
    warnings: [],
  }
  const warn = (m: string) => result.warnings.push(m)

  const mediaMap: IdMap = new Map()
  const pageMap: IdMap = new Map()
  const catMap: IdMap = new Map()

  // ── 1. Create the target tenant ────────────────────────────────────────────
  let targetTenantId: string | number | undefined
  try {
    const src = stripSystemFields(sourceTenant)
    const created = await payload.create({
      collection: 'tenants',
      data: {
        ...src,
        slug: targetSlug,
        domain: targetDomain,
        // fresh federation identity + no inherited beneficiaries
        federation: undefined,
        beneficiaries: undefined,
        domains: undefined,
      } as never,
      overrideAccess: true,
    })
    targetTenantId = created.id
    result.targetTenantId = targetTenantId
    result.steps.push({ collection: 'tenants', attempted: 1, created: 1, errors: 0 })
  } catch (e) {
    result.steps.push({
      collection: 'tenants',
      attempted: 1,
      created: 0,
      errors: 1,
      notes: [e instanceof Error ? e.message : String(e)],
    })
    warn('Tenant creation failed — aborting.')
    return result
  }

  const tid = targetTenantId as string | number

  // Generic per-collection create with remap, tracked as a step.
  const migrate = async (
    collection: string,
    docs: Doc[],
    opts: {
      idMap?: IdMap
      remapCategories?: boolean
      drop?: string[]
      useDbCreate?: boolean
    } = {},
  ) => {
    const step: TeleportStep = { collection, attempted: docs.length, created: 0, errors: 0, notes: [] }
    for (const raw of docs) {
      const oldId = raw.id as string | number
      try {
        let doc = stripSystemFields(raw)
        for (const f of opts.drop || []) delete (doc as Record<string, unknown>)[f]
        // deep media/page remap
        doc = deepRemap(doc, undefined, mediaMap, pageMap) as Doc
        // categories remap (hasMany relationship of ids)
        if (opts.remapCategories && Array.isArray((doc as Doc).categories)) {
          ;(doc as Doc).categories = ((doc as Doc).categories as unknown[])
            .map((c) => {
              const id = relId(c)
              return id != null ? catMap.get(id) : undefined
            })
            .filter((v) => v != null)
        }
        const data = { ...(doc as Doc), tenant: tid }

        let newId: string | number
        if (opts.useDbCreate) {
          const created = await (payload.db as unknown as {
            create: (a: { collection: string; data: Doc }) => Promise<Doc>
          }).create({ collection, data })
          newId = created.id as string | number
        } else {
          const created = (await payload.create({
            collection: collection as never,
            data: data as never,
            overrideAccess: true,
          })) as { id: string | number }
          newId = created.id
        }
        opts.idMap?.set(oldId, newId)
        step.created++
      } catch (e) {
        step.errors++
        step.notes!.push(`id ${oldId}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (!step.notes!.length) delete step.notes
    result.steps.push(step)
  }

  const get = (slug: string): Doc[] => (Array.isArray(data[slug]) ? (data[slug] as Doc[]) : [])

  // ── 2. Media (verbatim rows, no re-upload) ─────────────────────────────────
  await migrate('media', get('media'), { idMap: mediaMap, useDbCreate: true })

  // ── 3. Categories (leaf, before content that references them) ───────────────
  await migrate('categories', get('categories'), { idMap: catMap })

  // ── 4. Pages (build pageMap for nav/link remap) ─────────────────────────────
  await migrate('pages', get('pages'), { idMap: pageMap })

  // ── 5. Posts ────────────────────────────────────────────────────────────────
  await migrate('posts', get('posts'), { remapCategories: true, drop: ['relatedPosts'] })

  // ── 6. Products ──────────────────────────────────────────────────────────────
  await migrate('products', get('products'), {
    remapCategories: true,
    drop: ['relatedProducts', 'vendor', 'participants'],
  })

  // ── 7. Endeavor (drop federation/beneficiaries; primarySpace re-provisioned) ─
  await migrate('endeavors', get('endeavors'), {
    drop: ['federation', 'beneficiaries', 'primarySpace'],
  })

  // ── 8. Header / Footer (nav refs to pages/media remapped by deepRemap) ───────
  await migrate('header', get('header'))
  await migrate('footer', get('footer'))

  return result
}
