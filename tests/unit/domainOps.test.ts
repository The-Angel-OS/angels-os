import { describe, it, expect } from 'vitest'
import { normalizeDomain } from '@/endpoints/domain-ops'

const ok = (input: string) => {
  const r = normalizeDomain(input)
  if ('error' in r) throw new Error(`expected ${input} to be accepted, got: ${r.error}`)
  return r.domain
}
const err = (input: string) => {
  const r = normalizeDomain(input)
  if (!('error' in r)) throw new Error(`expected ${input} to be rejected, got: ${r.domain}`)
  return r.error
}

describe('normalizeDomain', () => {
  it('takes what an owner actually pastes', () => {
    expect(ok('WhereDidEveryoneGo.net')).toBe('wheredideveryonego.net')
    expect(ok('https://www.example.com/about?x=1')).toBe('www.example.com')
    expect(ok('  example.com.  ')).toBe('example.com')
    expect(ok('example.com:3000')).toBe('example.com')
  })

  it('rejects what is not a hostname', () => {
    expect(err('')).toMatch(/enter a domain/i)
    expect(err('example')).toMatch(/not a valid/i)
    expect(err('-bad.com')).toMatch(/not a valid/i)
    expect(err('exa mple.com')).toMatch(/not a valid/i)
  })

  // The whole reason this panel was read-only: a portal must not be able to
  // bind an address the platform mints from someone else's slug.
  it('refuses platform addresses', () => {
    expect(err('spacesangels.com')).toMatch(/platform address/i)
    expect(err('someoneelse.spacesangels.com')).toMatch(/platform address/i)
    expect(err('foo.kendev.co')).toMatch(/platform address/i)
    expect(err('bar.up.railway.app')).toMatch(/platform address/i)
  })

  it('does not refuse a domain that merely CONTAINS a platform apex', () => {
    expect(ok('notspacesangels.com')).toBe('notspacesangels.com')
  })
})
