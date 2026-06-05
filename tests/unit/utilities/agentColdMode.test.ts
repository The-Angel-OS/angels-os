/**
 * Agent-cold mode — FEDERATION_AGENT_AUTORESPOND gate on leoProcessMessage.
 * A federation test node (Node B / kendev.co) coordinates without spending tokens.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { agentAutoRespondEnabled, leoProcessMessage } from '@/utilities/leoProcessMessage'

const original = process.env.FEDERATION_AGENT_AUTORESPOND
afterEach(() => {
  if (original === undefined) delete process.env.FEDERATION_AGENT_AUTORESPOND
  else process.env.FEDERATION_AGENT_AUTORESPOND = original
})

describe('agentAutoRespondEnabled', () => {
  it('defaults to enabled when unset (prod unaffected)', () => {
    delete process.env.FEDERATION_AGENT_AUTORESPOND
    expect(agentAutoRespondEnabled()).toBe(true)
  })
  it('only "false" disables it', () => {
    process.env.FEDERATION_AGENT_AUTORESPOND = 'false'
    expect(agentAutoRespondEnabled()).toBe(false)
    process.env.FEDERATION_AGENT_AUTORESPOND = 'true'
    expect(agentAutoRespondEnabled()).toBe(true)
    process.env.FEDERATION_AGENT_AUTORESPOND = 'anything'
    expect(agentAutoRespondEnabled()).toBe(true)
  })
})

describe('leoProcessMessage — agent-cold', () => {
  it('suppresses the LLM and returns empty text when disabled', async () => {
    process.env.FEDERATION_AGENT_AUTORESPOND = 'false'
    const res = await leoProcessMessage({ message: 'hello, are you there?', conversationId: 'c1' })
    expect(res.suppressed).toBe(true)
    expect(res.text).toBe('')
    expect(res.conversationId).toBe('c1')
  })
})
