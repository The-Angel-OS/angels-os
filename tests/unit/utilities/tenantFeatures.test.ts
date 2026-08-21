import { describe, it, expect } from 'vitest'
import { hasFeature } from '@/utilities/tenantFeatures'
import { NAV_SECTIONS } from '@/app/[locale]/(dashboard)/dashboard/nav-config'

const ctx = (features?: { works?: boolean | null } | null) => ({
  isAuthenticated: true,
  isAdmin: true,
  isBusinessOwner: false,
  wizardComplete: true,
  permissions: [] as string[],
  tenantRole: 'tenant_admin',
  features,
})

const worksItem = NAV_SECTIONS.flatMap((s) => s.items).find((i) =>
  i.label.toLowerCase().includes('works'),
)

describe('tenant features', () => {
  it('defaults off — an unset tenant gets nothing', () => {
    expect(hasFeature(null, 'works')).toBe(false)
    expect(hasFeature({}, 'works')).toBe(false)
    expect(hasFeature({ features: null }, 'works')).toBe(false)
    expect(hasFeature({ features: { works: false } }, 'works')).toBe(false)
  })

  it('reads the flag when set', () => {
    expect(hasFeature({ features: { works: true } }, 'works')).toBe(true)
  })

  it('drives the Works nav item instead of a slug allow-list', () => {
    expect(worksItem).toBeTruthy()
    expect(worksItem!.visible(ctx({ works: true }))).toBe(true)
    expect(worksItem!.visible(ctx(null))).toBe(false)
    // The retired allow-list keyed off the slug; the slug must no longer matter.
    expect(worksItem!.visible({ ...ctx(null), tenantSlug: 'clearwater-cruisin' } as never)).toBe(
      false,
    )
  })
})
