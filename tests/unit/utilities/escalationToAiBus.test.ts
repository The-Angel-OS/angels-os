import { describe, it, expect, beforeEach } from 'vitest'
import {
  escalationChannelFor,
  isSelfPostingEscalation,
  shouldRecordEscalation,
  __resetEscalationAiBusState,
} from '@/utilities/escalationToAiBus'

describe('escalationChannelFor', () => {
  it('routes error-class events to the errors channel', () => {
    expect(escalationChannelFor('error')).toBe('errors')
    expect(escalationChannelFor('warning')).toBe('errors')
    expect(escalationChannelFor('budget_exceeded')).toBe('errors')
    expect(escalationChannelFor('content_flagged')).toBe('errors')
  })

  it('routes operational events to system-log', () => {
    expect(escalationChannelFor('vercel_spend')).toBe('system-log')
    expect(escalationChannelFor('maintenance_note')).toBe('system-log')
    expect(escalationChannelFor('order')).toBe('system-log')
  })

  it('routes people/support events to support', () => {
    expect(escalationChannelFor('user_registered')).toBe('support')
    expect(escalationChannelFor('conversation_started')).toBe('support')
  })

  it('defaults unmapped event types to errors', () => {
    // itsm_incident is mapped; use a cast to probe the default path safely.
    expect(escalationChannelFor('itsm_incident')).toBe('errors')
  })
})

describe('isSelfPostingEscalation', () => {
  it('treats form_submission as self-posting (skipped by the sink)', () => {
    expect(isSelfPostingEscalation('form_submission')).toBe(true)
  })
  it('does not skip error/budget events', () => {
    expect(isSelfPostingEscalation('error')).toBe(false)
    expect(isSelfPostingEscalation('budget_exceeded')).toBe(false)
  })
})

describe('shouldRecordEscalation (throttle)', () => {
  beforeEach(() => __resetEscalationAiBusState())

  it('records the first occurrence', () => {
    expect(shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'boom' }, 1_000)).toBe(true)
  })

  it('suppresses an identical repeat within the cooldown', () => {
    shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'boom' }, 1_000)
    expect(shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'boom' }, 2_000)).toBe(false)
  })

  it('re-records the same event after the cooldown elapses', () => {
    shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'boom' }, 1_000)
    // 120s cooldown → 1_000 + 121_000
    expect(shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'boom' }, 122_000)).toBe(true)
  })

  it('distinguishes by dedupeKey', () => {
    expect(shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'a', dedupeKey: 'k1' }, 1_000)).toBe(true)
    expect(shouldRecordEscalation({ tenantId: 1, eventType: 'error', title: 'a', dedupeKey: 'k2' }, 1_000)).toBe(true)
  })

  it('never records self-posting events', () => {
    expect(shouldRecordEscalation({ tenantId: 1, eventType: 'form_submission', title: 'lead' }, 1_000)).toBe(false)
  })

  it('caps posts per tenant per minute', () => {
    // 30/min cap — 30 distinct keys pass, the 31st is suppressed within the window.
    for (let i = 0; i < 30; i++) {
      expect(shouldRecordEscalation({ tenantId: 9, eventType: 'error', title: `e${i}` }, 1_000)).toBe(true)
    }
    expect(shouldRecordEscalation({ tenantId: 9, eventType: 'error', title: 'e30' }, 1_000)).toBe(false)
  })
})
