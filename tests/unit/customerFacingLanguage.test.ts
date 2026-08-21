import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * House vocabulary must not reach a customer.
 *
 * A visitor at a checkout is deciding whether to hand over money. "Constitutional
 * commerce", "Justice Fund", "Endeavor" and "Angel OS" all ask them to learn our
 * words first, which reads as evasive at exactly the wrong moment — and on a
 * prospect's own site it is worse than evasive, because the site is supposed to
 * be THEIRS. Ken's standing rule; this makes it checkable.
 *
 * Scope is the public storefront only. The dashboard is ours and may say what
 * it likes.
 */
const APP = join(process.cwd(), 'src', 'app', '[locale]', '(app)')

/** Pages a paying or giving customer actually lands on. */
const CUSTOMER_SURFACES = ['book', 'donate', 'shop', 'products', 'cart', 'checkout']

const BANNED = [
  'Justice Fund',
  'Constitutional commerce',
]

function filesUnder(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir, { recursive: true }) as unknown as string[]
  } catch {
    return out
  }
  for (const e of entries) {
    const f = String(e)
    if (f.endsWith('.tsx') || f.endsWith('.ts')) out.push(join(dir, f))
  }
  return out
}

/** Strip comments — a note ABOUT the banned words is not the banned words. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('customer-facing language', () => {
  it('never shows house vocabulary on a checkout or giving page', () => {
    const offenders: string[] = []
    for (const surface of CUSTOMER_SURFACES) {
      for (const file of filesUnder(join(APP, surface))) {
        const src = code(readFileSync(file, 'utf8'))
        for (const word of BANNED) {
          if (src.includes(word)) offenders.push(`${file.split('(app)')[1]}: "${word}"`)
        }
      }
    }
    expect(
      offenders,
      'These strings reach a paying customer. Say what happens to their money in ' +
        'plain words — "platform fee", not a house term they have to look up.',
    ).toEqual([])
  })
})
