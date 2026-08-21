import { describe, it, expect, vi } from 'vitest'
import {
  ensureTenantContactForm,
  resolveOwnerEmail,
  PLATFORM_LEADS_EMAIL,
} from '@/utilities/ensureTenantContactForm'

/**
 * The bug these cover: every portal shared one form whose only email row was the
 * Payload demo template — `emailTo: '{{email}}'` from `demo@payloadcms.com`. The
 * owner was never notified, and it looked fine in the admin.
 */

type Doc = Record<string, unknown>

function fakePayload(opts: {
  tenant?: Doc
  users?: Doc[]
  forms?: Doc[]
  pages?: Doc[]
}) {
  const created: Doc[] = []
  const updated: Array<{ collection: string; id: unknown; data: Doc }> = []
  const payload = {
    findByID: vi.fn(async () => opts.tenant ?? null),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'users') return { docs: opts.users ?? [] }
      if (collection === 'forms') return { docs: opts.forms ?? [] }
      if (collection === 'pages') return { docs: opts.pages ?? [] }
      return { docs: [] }
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Doc }) => {
      created.push({ collection, ...data })
      return { id: 99 }
    }),
    update: vi.fn(async ({ collection, id, data }: { collection: string; id: unknown; data: Doc }) => {
      updated.push({ collection, id, data })
      return { id }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, created, updated }
}

describe('resolveOwnerEmail', () => {
  it('prefers the storefront contact email', async () => {
    const { payload } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
      users: [{ email: 'someone@else.com' }],
    })
    expect(await resolveOwnerEmail(payload, 1)).toBe('owner@business.com')
  })

  it('falls back to a human on the tenant, never a system account', async () => {
    const { payload } = fakePayload({
      tenant: { storefront: {} },
      users: [
        { email: 'robot@angelos', isSystemUser: true },
        { email: 'real@business.com' },
      ],
    })
    // Mailing leads to the platform robot is the same failure with extra steps.
    expect(await resolveOwnerEmail(payload, 1)).toBe('real@business.com')
  })

  it('falls back to the platform inbox rather than nobody', async () => {
    // A demo site built FOR a prospect has no owner email and no admin until
    // they claim it. Before 260820 that meant a real customer's enquiry died in
    // the database with nobody notified.
    const { payload } = fakePayload({ tenant: { storefront: {} }, users: [] })
    expect(await resolveOwnerEmail(payload, 1)).toBe(PLATFORM_LEADS_EMAIL)
  })

  it('lets an owner who sets their own address win', async () => {
    const { payload } = fakePayload({
      tenant: { storefront: { contactEmail: 'bre@theirdomain.com' } },
      users: [],
    })
    expect(await resolveOwnerEmail(payload, 1)).toBe('bre@theirdomain.com')
  })
})

describe('ensureTenantContactForm', () => {
  it('creates a tenant-scoped form that notifies the owner, not the submitter', async () => {
    const { payload, created } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
    })
    const res = await ensureTenantContactForm(payload, 7)

    const form = created.find((c) => c.collection === 'forms')!
    expect(form.tenant).toBe(7)
    const emails = form.emails as Array<Record<string, string>>
    expect(emails).toHaveLength(1)
    expect(emails[0].emailTo).toBe('owner@business.com')
    // Reply goes to the customer; the FROM must stay on a domain we own or it
    // fails SPF and lands in spam.
    expect(emails[0].replyTo).toBe('{{email}}')
    expect(emails[0].emailFrom).not.toContain('{{email}}')
    expect(emails[0].emailFrom).not.toContain('payloadcms.com')
    expect(res.notifies).toBe('owner@business.com')
  })

  it('repairs an existing form that notifies the wrong address', async () => {
    const { payload, updated } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
      forms: [{ id: 5, emails: [{ emailTo: '{{email}}' }] }],
    })
    await ensureTenantContactForm(payload, 7)
    const fix = updated.find((u) => u.collection === 'forms')
    expect((fix!.data.emails as Array<Record<string, string>>)[0].emailTo).toBe('owner@business.com')
  })

  it('leaves a correctly-addressed form alone', async () => {
    const { payload, updated } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
      forms: [{ id: 5, emails: [{ emailTo: 'owner@business.com' }] }],
    })
    await ensureTenantContactForm(payload, 7)
    expect(updated.find((u) => u.collection === 'forms')).toBeUndefined()
  })

  it('repoints a contact page still bound to another form', async () => {
    // Every demo site built before 260818 has a formBlock pointing at the shared
    // form 1, so appending only when absent would leave them all misrouted.
    const { payload, updated } = fakePayload({
      tenant: { storefront: { contactEmail: 'owner@business.com' } },
      forms: [{ id: 5, emails: [{ emailTo: 'owner@business.com' }] }],
      pages: [{ id: 20, layout: [{ blockType: 'formBlock', form: 1 }] }],
    })
    const res = await ensureTenantContactForm(payload, 7)
    const pageFix = updated.find((u) => u.collection === 'pages')!
    expect((pageFix.data.layout as Array<{ form: unknown }>)[0].form).toBe(5)
    expect(res.pageWired).toBe(true)
  })

  it('routes a nobody-attached portal to the platform inbox, and says so', async () => {
    const { payload } = fakePayload({ tenant: { storefront: {} }, users: [] })
    const res = await ensureTenantContactForm(payload, 7)
    expect(res.notifies).toBe(PLATFORM_LEADS_EMAIL)
    // The log has to be honest about WHY, or nobody notices the portal is unclaimed.
    expect(res.note).toContain('platform inbox')
  })
})
