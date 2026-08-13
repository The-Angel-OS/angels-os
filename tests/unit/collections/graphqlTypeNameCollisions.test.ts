import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A Form Builder field block and a collection share ONE GraphQL type namespace,
 * and a duplicate name fails the entire schema build — not just the offending
 * type. `/api/graphql` returned 500 for every query for weeks because
 * `messages` and the plugin's built-in `message` block both wanted "Message";
 * fixing that revealed `signatures` vs our custom `signature` block underneath,
 * which cost a second deploy to discover.
 *
 * Cheaper to assert than to find in production. A collision is fine as long as
 * the collection declares its own `graphQL.singularName`.
 *
 * @see src/plugins/index.ts — the custom `signature` block
 * @see src/collections/Messages/index.ts — the first collision
 */

const ROOT = join(import.meta.dirname, '../../..')

/** Built-in Form Builder field blocks, plus any we add in src/plugins/index.ts. */
function formBuilderBlockSlugs(): Set<string> {
  const builtin = readFileSync(
    join(ROOT, 'node_modules/@payloadcms/plugin-form-builder/dist/collections/Forms/fields.js'),
    'utf-8',
  )
  const slugs = [...builtin.matchAll(/slug:\s*'([a-z]+)'/g)].map((m) => m[1]!)
  const ours = readFileSync(join(ROOT, 'src/plugins/index.ts'), 'utf-8')
  slugs.push(...[...ours.matchAll(/slug:\s*'([a-z]+)'/g)].map((m) => m[1]!))
  return new Set(slugs)
}

/** `messages` → `message`; good enough for the singular forms we actually use. */
const singularize = (slug: string): string =>
  slug.endsWith('ies') ? `${slug.slice(0, -3)}y` : slug.endsWith('s') ? slug.slice(0, -1) : slug

describe('GraphQL type names do not collide', () => {
  const blocks = formBuilderBlockSlugs()

  it('finds the form-builder blocks to check against', () => {
    expect(blocks.has('message')).toBe(true)
    expect(blocks.has('signature')).toBe(true)
  })

  it.each(globSync('src/collections/**/index.ts', { cwd: ROOT }))('%s', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf-8')
    const slug = /^\s{2}slug:\s*'([a-z-]+)'/m.exec(src)?.[1]
    if (!slug) return

    const collides = blocks.has(singularize(slug))
    const renamed = /graphQL:\s*\{[^}]*singularName/.test(src)

    expect(
      !collides || renamed,
      `collection '${slug}' collides with the Form Builder '${singularize(slug)}' block — ` +
        `give it graphQL: { singularName, pluralName } or the whole schema fails to build`,
    ).toBe(true)
  })
})
