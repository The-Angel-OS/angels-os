import { describe, it, expect, afterEach } from 'vitest'
import { liftComplexity, complexityFloorForRoles, getEscalatedComplexity } from '@/utilities/ai-gateway'

describe('liftComplexity', () => {
  it('lifts up to the floor, never below', () => {
    expect(liftComplexity('low', 'high')).toBe('high')
    expect(liftComplexity('medium', 'high')).toBe('high')
    expect(liftComplexity('critical', 'high')).toBe('critical') // already higher — unchanged
    expect(liftComplexity('high', 'low')).toBe('high') // floor below — no change
  })

  it('is a no-op when floor is low', () => {
    for (const t of ['low', 'medium', 'high', 'critical'] as const) {
      expect(liftComplexity(t, 'low')).toBe(t)
    }
  })
})

describe('complexityFloorForRoles', () => {
  afterEach(() => {
    delete process.env.LEO_STEWARD_TIER_FLOOR
  })

  it('super_admin → high (the strong-tier floor) by default', () => {
    expect(complexityFloorForRoles(['super_admin'])).toBe('high')
  })

  it('admin / archangel → medium', () => {
    expect(complexityFloorForRoles(['admin'])).toBe('medium')
    expect(complexityFloorForRoles(['archangel'])).toBe('medium')
  })

  it('regular user / none → low (no lift)', () => {
    expect(complexityFloorForRoles(['customer'])).toBe('low')
    expect(complexityFloorForRoles([])).toBe('low')
    expect(complexityFloorForRoles(undefined)).toBe('low')
  })

  it('the steward floor is env-tunable', () => {
    process.env.LEO_STEWARD_TIER_FLOOR = 'critical'
    expect(complexityFloorForRoles(['super_admin'])).toBe('critical')
    process.env.LEO_STEWARD_TIER_FLOOR = 'garbage'
    expect(complexityFloorForRoles(['super_admin'])).toBe('high') // invalid → default
  })
})

describe('floor composes with the escalation rhythm', () => {
  it('super_admin rides high normally and critical on deep-think rounds', () => {
    const floor = complexityFloorForRoles(['super_admin']) // 'high'
    // Turn 1 (standard 'medium') lifted to 'high'
    expect(liftComplexity(getEscalatedComplexity(1), floor)).toBe('high')
    // Turn 5 (escalation 'critical') stays 'critical'
    expect(liftComplexity(getEscalatedComplexity(5), floor)).toBe('critical')
  })

  it('a regular user is unaffected by the floor (rhythm only)', () => {
    const floor = complexityFloorForRoles(['customer']) // 'low'
    expect(liftComplexity(getEscalatedComplexity(1), floor)).toBe(getEscalatedComplexity(1))
    expect(liftComplexity(getEscalatedComplexity(5), floor)).toBe(getEscalatedComplexity(5))
  })
})
