/**
 * Bookable service catalog — pure config + money math.
 */
import { describe, it, expect } from 'vitest'
import {
  getBookableServices,
  getBookableService,
  depositCents,
  totalCents,
} from '@/config/bookableServices'

describe('bookableServices', () => {
  describe('getBookableServices', () => {
    it('returns the Clearwater Cruisin catalog (3 services)', () => {
      const svcs = getBookableServices('clearwater-cruisin')
      expect(svcs).toHaveLength(3)
      expect(svcs.map((s) => s.id)).toEqual([
        'pressure-washing-driveway',
        'pressure-washing-house',
        'pet-sitting-visit',
      ])
    })

    it('returns [] for unknown or missing tenant', () => {
      expect(getBookableServices('no-such-tenant')).toEqual([])
      expect(getBookableServices(undefined)).toEqual([])
      expect(getBookableServices(null)).toEqual([])
    })
  })

  describe('getBookableService', () => {
    it('finds a service by id within a tenant', () => {
      const svc = getBookableService('clearwater-cruisin', 'pressure-washing-house')
      expect(svc).not.toBeNull()
      expect(svc?.priceUSD).toBe(249)
      expect(svc?.durationMinutes).toBe(180)
      expect(svc?.depositPercent).toBe(20)
    })

    it('returns null for an unknown service id or missing args', () => {
      expect(getBookableService('clearwater-cruisin', 'nope')).toBeNull()
      expect(getBookableService('clearwater-cruisin', undefined)).toBeNull()
      expect(getBookableService(null, 'pressure-washing-house')).toBeNull()
    })
  })

  describe('money math (whole cents)', () => {
    it('totalCents converts dollars to cents', () => {
      const house = getBookableService('clearwater-cruisin', 'pressure-washing-house')!
      expect(totalCents(house)).toBe(24900)
    })

    it('depositCents applies depositPercent and rounds to whole cents', () => {
      const house = getBookableService('clearwater-cruisin', 'pressure-washing-house')!
      expect(depositCents(house)).toBe(4980) // 249 * 20%

      const driveway = getBookableService('clearwater-cruisin', 'pressure-washing-driveway')!
      expect(depositCents(driveway)).toBe(2380) // 119 * 20%

      const pet = getBookableService('clearwater-cruisin', 'pet-sitting-visit')!
      expect(depositCents(pet)).toBe(500) // 25 * 20%
    })

    it('balance = total - deposit is always non-negative and consistent', () => {
      for (const svc of getBookableServices('clearwater-cruisin')) {
        const balance = totalCents(svc) - depositCents(svc)
        expect(balance).toBeGreaterThanOrEqual(0)
        expect(depositCents(svc) + balance).toBe(totalCents(svc))
      }
    })
  })
})
