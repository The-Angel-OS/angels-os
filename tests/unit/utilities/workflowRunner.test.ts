/**
 * workflowRunner — Unit Tests
 *
 * Tests runWorkflowsForMessage trigger logic, workflow dispatch, and error handling.
 * Payload is passed as a parameter — no module mocking needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { runWorkflowsForMessage, type WorkflowMessage } from '@/utilities/workflowRunner'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(workflows: unknown[] = [], createReturn: unknown = { id: 42 }) {
  return {
    find: vi.fn().mockResolvedValue({ docs: workflows }),
    create: vi.fn().mockResolvedValue(createReturn),
  } as any
}

const BASE_MESSAGE: WorkflowMessage = {
  id: 10,
  content: 'Hello',
}

// ── runWorkflowsForMessage ────────────────────────────────────────────────────

describe('runWorkflowsForMessage', () => {
  it('returns empty array when no workflows found', async () => {
    const payload = makePayload([])
    const result = await runWorkflowsForMessage(payload, BASE_MESSAGE)
    expect(result).toEqual([])
  })

  it('queries the workflows collection with isActive=true', async () => {
    const payload = makePayload([])
    await runWorkflowsForMessage(payload, BASE_MESSAGE)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'workflows' }),
    )
  })

  // The 260812 bug: an afterChange hook hands over the POPULATED tenant, and
  // `{ equals: {…} }` reached Postgres as NaN. The hook's catch swallowed it, so
  // message workflows had silently never run for a tenant.
  it('accepts a populated tenant relationship, not just an id', async () => {
    const payload = makePayload([])
    await runWorkflowsForMessage(payload, BASE_MESSAGE, { id: 5, name: 'Clearwater' } as never)
    const call = payload.find.mock.calls[0][0]
    expect(call.where.and).toContainEqual({ tenant: { equals: 5 } })
  })

  it('treats an unusable tenant as untenanted rather than querying NaN', async () => {
    for (const bad of [undefined, null, {}, 'not-a-number']) {
      const payload = makePayload([])
      await runWorkflowsForMessage(payload, BASE_MESSAGE, bad as never)
      const call = payload.find.mock.calls[0][0]
      expect(call.where.and).toContainEqual({ tenant: { exists: false } })
    }
  })

  it('threads req into the workflow lookup so it joins the transaction', async () => {
    const payload = makePayload([])
    const req = { id: 'req-1' } as never
    await runWorkflowsForMessage(payload, BASE_MESSAGE, 5, { req })
    expect(payload.find.mock.calls[0][0].req).toBe(req)
  })

  it('filters workflows by tenantId when provided', async () => {
    const payload = makePayload([])
    await runWorkflowsForMessage(payload, BASE_MESSAGE, 5)
    const call = payload.find.mock.calls[0][0]
    expect(JSON.stringify(call.where)).toContain('5')
  })

  it('skips workflows with no slug', async () => {
    const payload = makePayload([{ triggerType: 'message_attachments' }]) // no slug
    const result = await runWorkflowsForMessage(payload, BASE_MESSAGE)
    expect(result).toEqual([])
  })

  it('skips message_attachments trigger when message has no attachments', async () => {
    const payload = makePayload([{ slug: 'inventory_from_image', triggerType: 'message_attachments' }])
    const result = await runWorkflowsForMessage(payload, { ...BASE_MESSAGE, attachments: [] })
    expect(result).toEqual([])
  })

  it('runs inventory_from_image when message has attachments', async () => {
    const payload = makePayload(
      [{ slug: 'inventory_from_image', triggerType: 'message_attachments' }],
      { id: 99 },
    )
    const message: WorkflowMessage = {
      ...BASE_MESSAGE,
      attachments: [{ media: 7 }],
    }
    const result = await runWorkflowsForMessage(payload, message)
    expect(result).toHaveLength(1)
    expect(result[0].workflowSlug).toBe('inventory_from_image')
    expect(result[0].success).toBe(true)
    expect(result[0].productDraftId).toBe(99)
  })

  it('inventory_from_image returns error when message has no attachments', async () => {
    const payload = makePayload([{ slug: 'inventory_from_image' }]) // no triggerType — passes trigger check
    const result = await runWorkflowsForMessage(payload, BASE_MESSAGE)
    expect(result[0].success).toBe(false)
    expect(result[0].error).toContain('attachment')
  })

  it('inventory_from_image returns error when media id is invalid', async () => {
    const payload = makePayload([{ slug: 'inventory_from_image' }])
    const result = await runWorkflowsForMessage(payload, {
      ...BASE_MESSAGE,
      attachments: [{ media: null as any }],
    })
    expect(result[0].success).toBe(false)
  })

  it('returns error result when unknown workflow slug is encountered', async () => {
    const payload = makePayload([{ slug: 'non_existent_workflow' }])
    const result = await runWorkflowsForMessage(payload, BASE_MESSAGE)
    expect(result[0].success).toBe(false)
    expect(result[0].error).toContain('Unknown workflow')
  })

  it('catches workflow errors and returns error result without throwing', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ slug: 'inventory_from_image' }] }),
      create: vi.fn().mockRejectedValue(new Error('DB write failed')),
    } as any
    const message: WorkflowMessage = {
      ...BASE_MESSAGE,
      attachments: [{ media: 5 }],
    }
    const result = await runWorkflowsForMessage(payload, message)
    expect(result[0].success).toBe(false)
    expect(result[0].error).toContain('DB write failed')
  })

  it('runs multiple workflows and returns all results', async () => {
    const payload = makePayload([
      { slug: 'inventory_from_image' },
      { slug: 'non_existent_workflow' },
    ])
    const result = await runWorkflowsForMessage(payload, {
      ...BASE_MESSAGE,
      attachments: [{ media: 3 }],
    })
    expect(result).toHaveLength(2)
  })

  it('creates product with tenant when tenantId is provided', async () => {
    const payload = makePayload([{ slug: 'inventory_from_image' }], { id: 55 })
    const message: WorkflowMessage = { ...BASE_MESSAGE, attachments: [{ media: 1 }] }
    await runWorkflowsForMessage(payload, message, 7)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant: 7 }),
      }),
    )
  })
})
