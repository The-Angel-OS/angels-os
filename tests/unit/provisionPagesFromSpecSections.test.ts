/**
 * The `sections` spec is what stands a real marketing site up from JSON, so the
 * two things that silently ruin a page get pinned here: a block emitted with the
 * wrong field shape (Payload rejects the whole save) and the mediaOnLeft
 * inversion (the spec reads left-to-right, the column stores which side the
 * MEDIA is on — easy to flip and impossible to notice in a diff).
 */
import { describe, expect, it, vi } from 'vitest'
import { buildSection, provisionPagesFromSpec } from '@/utilities/provisionPagesFromSpec'

// The helper's result key is `formId`; reading `.id` used to silently yield null
// and drop the form block off the page with no error anywhere.
vi.mock('@/utilities/ensureTenantContactForm', () => ({
  ensureTenantContactForm: async () => ({ formId: 42, formCreated: false, pageWired: true, note: 'stub' }),
}))

describe('buildSection', () => {
  it('emits a gallery with images as {image} rows', () => {
    const b = buildSection({ gallery: { heading: 'Studio', columns: '4', images: [1, 2] } }, null)
    expect(b).toEqual({ blockType: 'gallery', heading: 'Studio', columns: '4', images: [{ image: 1 }, { image: 2 }] })
  })

  it('defaults gallery columns to 3 and drops an empty gallery', () => {
    expect(buildSection({ gallery: { images: [7] } }, null)!.columns).toBe('3')
    expect(buildSection({ gallery: { images: [] } }, null)).toBeNull()
  })

  it('inverts mediaOnLeft into the block’s videoOnRight column', () => {
    expect(buildSection({ mediaText: { heading: 'x', mediaOnLeft: true } }, null)!.videoOnRight).toBe(false)
    expect(buildSection({ mediaText: { heading: 'x' } }, null)!.videoOnRight).toBe(true)
  })

  it('keeps faq answers and defaults openFirst on', () => {
    const b = buildSection({ faq: { items: [{ question: 'q', answer: 'a' }] } }, null)
    expect(b.blockType).toBe('faq')
    expect(b.openFirst).toBe(true)
    expect(b.items).toEqual([{ question: 'q', answer: 'a' }])
  })

  it('only wires a contact form when one was resolved', () => {
    expect(buildSection({ contactForm: true }, 9)).toEqual({ blockType: 'formBlock', form: 9, enableIntro: false })
    expect(buildSection({ contactForm: true }, null)).toBeNull()
  })

  it('returns null for a section naming nothing buildable', () => {
    expect(buildSection({}, 1)).toBeNull()
  })
})

describe('provisionPagesFromSpec contact form', () => {
  it('resolves the tenant form and writes a formBlock into the layout', async () => {
    const created: Array<Record<string, any>> = []
    const payload = {
      find: async () => ({ docs: [] }),
      create: async ({ data }: { data: Record<string, any> }) => created.push(data),
      update: async () => undefined,
    } as any

    await provisionPagesFromSpec(payload, 32, [
      { slug: 'contact', title: 'Contact', heroHeading: 'Get in touch', sections: [{ contactForm: true }] },
    ])

    expect(created[0].layout).toEqual([{ blockType: 'formBlock', form: 42, enableIntro: false }])
  })
})
