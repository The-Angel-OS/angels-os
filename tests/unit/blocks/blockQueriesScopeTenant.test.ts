import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Blocks that QUERY content must scope it to the page's tenant themselves.
 *
 * ArchiveBlock and Carousel both shipped with no tenant filter, relying on
 * access control alone. That scopes an anonymous visitor and does NOT scope a
 * super_admin, so browsing a customer's own site showed other tenants' posts
 * and products mixed into their archive (reported 260830). It also means any
 * future loosening of access turns every one of these blocks into a leak.
 *
 * A string test rather than a render test on purpose: the failure being guarded
 * is "somebody wrote a payload.find here without a tenant clause", which is
 * visible in the source and cheap to check. A render test would need a Payload
 * instance and would not fail for the next block someone adds.
 */
const BLOCKS_THAT_QUERY = ['ArchiveBlock', 'Carousel']

describe('content blocks scope their queries to the tenant', () => {
  for (const block of BLOCKS_THAT_QUERY) {
    it(`${block} filters by tenant`, () => {
      const src = readFileSync(join(process.cwd(), 'src/blocks', block, 'Component.tsx'), 'utf8')
      expect(src).toContain('resolveTenantFromHeaders')
      expect(src).toMatch(/tenant:\s*\{\s*equals:\s*tenant\.id\s*\}/)
    })
  }
})
