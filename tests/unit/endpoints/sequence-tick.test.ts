/**
 * The tick sends real email to real customers unattended, so its edges matter
 * more than its happy path: an unsubscribed contact must never be mailed, a
 * dead address must stop rather than retry forever, and a slow tick must not
 * let step 3 drift days late.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/utilities/resolveEmailSender', () => ({
  resolveEmailSender: vi.fn().mockResolvedValue({ sendEmail: mockSendEmail }),
}))
vi.mock('@/utilities/getURL', () => ({ getServerSideURL: () => 'https://example.test' }))
vi.mock('@/utilities/logError', () => ({ logError: vi.fn().mockResolvedValue(undefined) }))

import { sequenceTickHandler } from '@/endpoints/sequence-tick'

const HOUR = 3600_000
const ENROLLED_AT = '2026-08-01T00:00:00.000Z'

const SEQUENCE = {
  isActive: true,
  steps: [
    { delayHours: 0, subject: 'Hi {{name}}', body: '<p>Hello {{name}}</p>' },
    { delayHours: 72, subject: 'Still there?', body: '<p>Last chance</p>' },
  ],
}

function enrolment(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenant: 42,
    sequence: SEQUENCE,
    contact: { id: 7, email: 'buyer@example.com', name: 'Dana', contactStatus: 'active', unsubscribeToken: 'tok' },
    currentStep: 0,
    enrolledAt: ENROLLED_AT,
    sendFailures: 0,
    ...over,
  }
}

function makeReq(docs: unknown[]) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs }),
    update: vi.fn().mockResolvedValue({}),
  }
  const req = new Request('http://localhost/api/sequence-ops/tick', { method: 'POST' })
  return Object.assign(req, { payload }) as never
}

const updateArg = (req: unknown, i = 0) =>
  ((req as { payload: { update: { mock: { calls: unknown[][] } } } }).payload.update.mock.calls[i]![0]) as {
    data: Record<string, unknown>
  }

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.CRON_SECRET
})

describe('sequence tick — sending', () => {
  it('sends the due step, personalised, and advances', async () => {
    const req = makeReq([enrolment()])
    const res = await sequenceTickHandler(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ sent: 1 })
    expect(mockSendEmail).toHaveBeenCalledOnce()
    const mail = mockSendEmail.mock.calls[0]![0] as { to: string; subject: string; html: string }
    expect(mail.to).toBe('buyer@example.com')
    expect(mail.subject).toBe('Hi Dana')
    expect(mail.html).toContain('Hello Dana')
    expect(mail.html).toContain('/unsubscribe/tok') // every send carries a way out
    expect(updateArg(req).data.currentStep).toBe(1)
  })

  it('schedules the next step from ENROLMENT, so a late tick cannot compound drift', async () => {
    const req = makeReq([enrolment()])
    await sequenceTickHandler(req)
    const next = new Date(updateArg(req).data.nextSendAt as string).getTime()
    // Step 2 is delayHours 72 — 72h after enrolment, not 72h after this send.
    expect(next).toBe(new Date(ENROLLED_AT).getTime() + 72 * HOUR)
  })

  it('completes the enrolment after the last step', async () => {
    const req = makeReq([enrolment({ currentStep: 1 })])
    await sequenceTickHandler(req)
    expect(updateArg(req).data.status).toBe('completed')
    expect(updateArg(req).data.nextSendAt).toBeNull()
  })
})

describe('sequence tick — the things that must not happen', () => {
  it('never emails an unsubscribed contact', async () => {
    const req = makeReq([
      enrolment({ contact: { id: 7, email: 'x@example.com', contactStatus: 'unsubscribed' } }),
    ])
    await sequenceTickHandler(req)
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(updateArg(req).data).toMatchObject({ status: 'stopped', stoppedReason: 'unsubscribed' })
  })

  it('stops when the sequence has been switched off mid-flight', async () => {
    const req = makeReq([enrolment({ sequence: { ...SEQUENCE, isActive: false } })])
    await sequenceTickHandler(req)
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(updateArg(req).data.status).toBe('completed')
  })

  it('backs off an hour on a transient failure rather than hammering the provider', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('smtp down'))
    const req = makeReq([enrolment()])
    const res = await sequenceTickHandler(req)

    await expect(res.json()).resolves.toMatchObject({ failed: 1 })
    expect(updateArg(req).data.sendFailures).toBe(1)
    expect(updateArg(req).data.nextSendAt).toBeTruthy()
  })

  it('gives up on a permanently failing address instead of retrying forever', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('550 no such user'))
    const req = makeReq([enrolment({ sendFailures: 2 })]) // third strike
    await sequenceTickHandler(req)
    expect(updateArg(req).data).toMatchObject({ status: 'stopped', stoppedReason: 'failed' })
  })

  it('only asks for enrolments that are actually DUE', async () => {
    const req = makeReq([])
    await sequenceTickHandler(req)
    const where = JSON.stringify(
      ((req as { payload: { find: { mock: { calls: unknown[][] } } } }).payload.find.mock.calls[0]![0] as { where: unknown }).where,
    )
    expect(where).toContain('less_than_equal')
    expect(where).toContain('active')
  })

  it('refuses an unauthenticated call when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'shh'
    const res = await sequenceTickHandler(makeReq([enrolment()]))
    expect(res.status).toBe(401)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
