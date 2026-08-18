import { describe, it, expect, vi } from 'vitest'
import {
  ensureSignupForm,
  signupFormFields,
  tradeOptions,
  SIGNUP_FORM_TITLE,
} from '@/utilities/ensureSignupForm'
import { TRADE_KEYS, resolveTradePack } from '@/utilities/demoSiteTemplates'

function fakePayload(opts: { tenant?: Record<string, unknown>; forms?: Array<Record<string, unknown>> } = {}) {
  const created: Array<Record<string, unknown>> = []
  const updated: Array<Record<string, unknown>> = []
  const payload = {
    findByID: vi.fn(async () => opts.tenant ?? null),
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'forms' ? (opts.forms ?? []) : [],
    })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: 42 }
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      updated.push(data)
      return { id: 1 }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, created, updated }
}

describe('signup form fields', () => {
  it('asks for everything demo-site needs to build without a phone call', async () => {
    const names = signupFormFields().map((f) => f.name)
    // The generic contact form collected none of the first three, which is why
    // every signup used to turn into phone tag before anything could be built.
    expect(names).toContain('business-name')
    expect(names).toContain('trade')
    expect(names).toContain('city')
    expect(names).toContain('email')
  })

  it('offers trades that actually resolve onto a content pack', () => {
    for (const opt of tradeOptions()) {
      // A trade the builder cannot resolve would silently fall back to the
      // generic pack, producing a site that reads like nobody's business.
      expect(TRADE_KEYS).toContain(resolveTradePack(opt.value).key)
    }
  })

  it('derives its options from the packs so a new vertical cannot drift out', () => {
    expect(tradeOptions().map((o) => o.value).sort()).toEqual([...TRADE_KEYS].sort())
  })
})

describe('ensureSignupForm', () => {
  it('creates a tenant-scoped form that notifies the owner', async () => {
    const { payload, created } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
    })
    const res = await ensureSignupForm(payload, 5)

    expect(res.created).toBe(true)
    expect(created[0]!.tenant).toBe(5)
    expect(created[0]!.title).toBe(SIGNUP_FORM_TITLE)
    const emails = created[0]!.emails as Array<Record<string, string>>
    expect(emails[0]!.emailTo).toBe('owner@business.com')
    expect(emails[0]!.emailFrom).not.toContain('{{email}}')
  })

  it('is idempotent and does not clobber fields an owner has edited', async () => {
    const { payload, created } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
      forms: [{ id: 9, emails: [{ emailTo: 'owner@business.com' }] }],
    })
    const res = await ensureSignupForm(payload, 5)

    expect(res.created).toBe(false)
    expect(res.formId).toBe(9)
    expect(created).toHaveLength(0)
  })
})
