/**
 * index (spaceProvisioning) — Unit Tests
 *
 * Tests pure/structural helpers: SPACE_TEMPLATES, getAvailableTemplates
 */
import { describe, it, expect } from 'vitest'

import { SPACE_TEMPLATES, getAvailableTemplates } from '@/utilities/index'

describe('SPACE_TEMPLATES', () => {
  it('contains service-provider template', () => {
    expect(SPACE_TEMPLATES['service-provider']).toBeDefined()
    expect(SPACE_TEMPLATES['service-provider'].name).toBe('Service Provider')
  })

  it('contains retail-commerce template', () => {
    expect(SPACE_TEMPLATES['retail-commerce']).toBeDefined()
  })

  it('contains creator-content template', () => {
    expect(SPACE_TEMPLATES['creator-content']).toBeDefined()
  })

  it('contains booking-based template', () => {
    expect(SPACE_TEMPLATES['booking-based']).toBeDefined()
  })

  it('contains custom template', () => {
    expect(SPACE_TEMPLATES['custom']).toBeDefined()
  })

  it('each template has channels array', () => {
    Object.values(SPACE_TEMPLATES).forEach(template => {
      expect(Array.isArray(template.channels)).toBe(true)
      expect(template.channels.length).toBeGreaterThan(0)
    })
  })

  it('each template has endeavorType matching its key', () => {
    Object.entries(SPACE_TEMPLATES).forEach(([key, template]) => {
      expect(template.endeavorType).toBe(key)
    })
  })
})

describe('getAvailableTemplates', () => {
  it('returns an array', () => {
    expect(Array.isArray(getAvailableTemplates())).toBe(true)
  })

  it('returns one entry per template', () => {
    const templates = getAvailableTemplates()
    const templateCount = Object.keys(SPACE_TEMPLATES).length
    expect(templates).toHaveLength(templateCount)
  })

  it('each entry has key and template properties', () => {
    getAvailableTemplates().forEach(entry => {
      expect(entry).toHaveProperty('key')
      expect(entry).toHaveProperty('template')
    })
  })

  it('keys match SPACE_TEMPLATES keys', () => {
    const keys = getAvailableTemplates().map(e => e.key)
    expect(keys).toContain('service-provider')
    expect(keys).toContain('retail-commerce')
    expect(keys).toContain('custom')
  })
})
