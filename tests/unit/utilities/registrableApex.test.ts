import { describe, it, expect } from 'vitest'
import { synthesizeStorefront, tenantStorefrontUrl } from '@/utilities/registrableApex'

describe('storefront canonical — root portal is www.<apex>', () => {
  const apex = 'spacesangels.com'

  it('root tenant (slug === apex label) → www.<apex>, not bare apex', () => {
    expect(synthesizeStorefront('spacesangels', apex)).toBe('https://www.spacesangels.com')
  })

  it('sub-tenant stays slug.<apex>', () => {
    expect(synthesizeStorefront('clearwater', apex)).toBe('https://clearwater.spacesangels.com')
  })

  it('domain === node apex (root brand) → www.<apex>', () => {
    expect(tenantStorefrontUrl({ domain: 'spacesangels.com', slug: 'spacesangels' }, apex))
      .toBe('https://www.spacesangels.com')
  })

  it('domain given as www.<apex> also normalizes to www.<apex>', () => {
    expect(tenantStorefrontUrl({ domain: 'www.spacesangels.com', slug: 'spacesangels' }, apex))
      .toBe('https://www.spacesangels.com')
  })

  it('BYO custom primary domain is honored (not force-www-prefixed)', () => {
    expect(
      tenantStorefrontUrl(
        { slug: 'acme', domains: [{ domain: 'shop.acme.com', isPrimary: true }] },
        apex,
      ),
    ).toBe('https://shop.acme.com')
  })
})
