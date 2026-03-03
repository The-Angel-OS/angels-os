/**
 * Default Federation Skills — Unit Tests
 *
 * Tests getDefaultSkills() shape, field values, and constitutional compliance.
 * Uses validateSkillDefinition from skills.ts to confirm each skill is valid.
 */
import { describe, it, expect } from 'vitest'

import { getDefaultSkills } from '@/federation/defaultSkills'
import { validateSkillDefinition } from '@/federation/skills'

// ── getDefaultSkills ──────────────────────────────────────────────────────────

describe('getDefaultSkills', () => {
  it('returns an array', async () => {
    const skills = await getDefaultSkills()
    expect(Array.isArray(skills)).toBe(true)
  })

  it('returns exactly 5 skills', async () => {
    const skills = await getDefaultSkills()
    expect(skills).toHaveLength(5)
  })

  it('every skill has a non-empty name', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(s.name.length).toBeGreaterThan(0))
  })

  it('every skill has semver version', async () => {
    const skills = await getDefaultSkills()
    const semverRe = /^\d+\.\d+\.\d+$/
    skills.forEach(s => expect(semverRe.test(s.version)).toBe(true))
  })

  it('every skill has a description of at least 10 chars', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(s.description.length).toBeGreaterThanOrEqual(10))
  })

  it('every skill has an inputSchema object', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(typeof s.inputSchema).toBe('object'))
  })

  it('every skill has an outputSchema object', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(typeof s.outputSchema).toBe('object'))
  })

  it('every skill has a non-negative costCents', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(s.costCents).toBeGreaterThanOrEqual(0))
  })

  it('every skill has a positive rateLimit', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(s.rateLimit).toBeGreaterThan(0))
  })

  it('every skill is enabled', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => expect(s.enabled).toBe(true))
  })

  it('passes validateSkillDefinition for all skills', async () => {
    const skills = await getDefaultSkills()
    skills.forEach(s => {
      const result = validateSkillDefinition(s)
      expect(result.valid).toBe(true)
    })
  })

  // ── Individual skill assertions ──────────────────────────────────────────

  it('search_catalog is free (costCents=0) with probationary trust', async () => {
    const skills = await getDefaultSkills()
    const skill = skills.find(s => s.name === 'search_catalog')
    expect(skill).toBeDefined()
    expect(skill!.costCents).toBe(0)
    expect(skill!.requiresTrust).toBe('probationary')
    expect(skill!.category).toBe('catalog')
    expect(skill!.safety.canModifyUserData).toBe(false)
  })

  it('search_events is free and read-only', async () => {
    const skills = await getDefaultSkills()
    const skill = skills.find(s => s.name === 'search_events')
    expect(skill).toBeDefined()
    expect(skill!.costCents).toBe(0)
    expect(skill!.safety.canModifyUserData).toBe(false)
  })

  it('check_availability is free and in booking category', async () => {
    const skills = await getDefaultSkills()
    const skill = skills.find(s => s.name === 'check_availability')
    expect(skill).toBeDefined()
    expect(skill!.category).toBe('booking')
    expect(skill!.costCents).toBe(0)
    expect(skill!.safety.canModifyUserData).toBe(false)
  })

  it('book_service requires vouched trust and declares side effects', async () => {
    const skills = await getDefaultSkills()
    const skill = skills.find(s => s.name === 'book_service')
    expect(skill).toBeDefined()
    expect(skill!.requiresTrust).toBe('vouched')
    expect(skill!.safety.canModifyUserData).toBe(true)
    expect(skill!.safety.sideEffects.length).toBeGreaterThan(0)
    expect(skill!.safety.disclosesAIOrigin).toBe(true)
  })

  it('generate_image costs 5 cents and is in content category', async () => {
    const skills = await getDefaultSkills()
    const skill = skills.find(s => s.name === 'generate_image')
    expect(skill).toBeDefined()
    expect(skill!.costCents).toBe(5)
    expect(skill!.category).toBe('content')
    expect(skill!.requiresTrust).toBe('vouched')
  })
})
