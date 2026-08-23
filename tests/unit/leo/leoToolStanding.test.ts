/**
 * Every LEO tool declares the standing it requires.
 *
 * The point of this test is the FIRST assertion: a tool added without anyone
 * deciding who may call it falls through to `manager`, which is safe but almost
 * certainly not considered. This fails until it is listed on purpose.
 *
 * @see src/utilities/leoToolStanding.ts
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { standingFor, standingMeets, DECLARED_TOOLS } from '@/utilities/leoToolStanding'

/** Tool names read from the source, so this cannot drift from the registry. */
function toolNames(): string[] {
  const src = readFileSync('src/utilities/leo-data-tools.ts', 'utf8')
  const names = new Set<string>()
  for (const m of src.matchAll(/^\s+name: '([a-z0-9_]+)',$/gm)) names.add(m[1]!)
  return [...names]
}

describe('every tool has a considered standing', () => {
  it('no tool falls through to the default unconsidered', () => {
    const undeclared = toolNames().filter((n) => !(n in DECLARED_TOOLS))
    expect(
      undeclared,
      `These LEO tools have no declared standing, so they default to 'manager'.\n` +
        `Decide who may call each one and list it in leoToolStanding.ts:\n  ${undeclared.join('\n  ')}`,
    ).toEqual([])
  })

  it('reads a real registry (guards against the regex silently matching nothing)', () => {
    expect(toolNames().length).toBeGreaterThan(100)
  })
})

describe('the rungs contain each other', () => {
  it('a higher standing satisfies every lower requirement', () => {
    expect(standingMeets('platform', 'manager')).toBe(true)
    expect(standingMeets('manager', 'member')).toBe(true)
    expect(standingMeets('member', 'anonymous')).toBe(true)
  })

  it('a lower standing never satisfies a higher requirement', () => {
    expect(standingMeets('member', 'manager')).toBe(false)
    expect(standingMeets('manager', 'platform')).toBe(false)
    expect(standingMeets('anonymous', 'member')).toBe(false)
  })
})

describe('the dangerous tools are actually held high', () => {
  it.each(['provision_tenant', 'decommission_tenant', 'query_sql', 'set_platform_fee'])(
    '%s is platform-only',
    (tool) => expect(standingFor(tool)).toBe('platform'),
  )

  it.each(['issue_refund', 'query_financial_reports', 'send_email', 'payload_update', 'payload_delete'])(
    '%s is at least manager',
    (tool) => expect(standingMeets('member', standingFor(tool))).toBe(false),
  )

  it('a public product search stays reachable by a visitor', () => {
    expect(standingFor('query_products')).toBe('anonymous')
  })
})
