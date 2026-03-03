import { describe, it, expect, beforeEach } from 'vitest'
import { TokenOptimizer } from '@/utilities/tokenOptimizer'

describe('TokenOptimizer', () => {
  let optimizer: TokenOptimizer

  beforeEach(() => {
    optimizer = new TokenOptimizer()
  })

  it('allows usage within the token limit', async () => {
    const allowed = await optimizer.checkUsage(50)
    expect(allowed).toBe(true)
  })

  it('accumulates usage across multiple calls', async () => {
    await optimizer.checkUsage(50)
    await optimizer.checkUsage(50)
    const allowed = await optimizer.checkUsage(50)
    // 50 + 50 + 50 = 150 — exactly at the 150 limit
    expect(allowed).toBe(true)
  })

  it('blocks usage that would exceed the token limit', async () => {
    await optimizer.checkUsage(100)
    const allowed = await optimizer.checkUsage(51) // 100 + 51 > 150
    expect(allowed).toBe(false)
  })

  it('does not add to usage when blocked', async () => {
    await optimizer.checkUsage(100)
    await optimizer.checkUsage(51) // blocked
    const allowed = await optimizer.checkUsage(50) // 100 + 50 = 150 — should still fit
    expect(allowed).toBe(true)
  })

  it('allows exactly the limit in one call', async () => {
    const allowed = await optimizer.checkUsage(150)
    expect(allowed).toBe(true)
  })

  it('blocks usage of one more than the limit', async () => {
    const allowed = await optimizer.checkUsage(151)
    expect(allowed).toBe(false)
  })

  it('resets usage to 0 on resetMonthly()', async () => {
    await optimizer.checkUsage(140)
    optimizer.resetMonthly()
    const allowed = await optimizer.checkUsage(140) // should pass again after reset
    expect(allowed).toBe(true)
  })

  it('allows zero-token usage', async () => {
    const allowed = await optimizer.checkUsage(0)
    expect(allowed).toBe(true)
  })
})
