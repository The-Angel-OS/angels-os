/**
 * connectorProbes — Unit Tests
 *
 * Tests the early-return (missing-credential) paths and the default dispatch
 * cases that do NOT make any network calls.
 */
import { describe, it, expect } from 'vitest'

import { runProbe } from '@/utilities/connectorProbes'

// ── runProbe dispatch ──────────────────────────────────────────────────────────

describe('runProbe', () => {
  // ── email_inbound — always passes without HTTP ─────────────────────────────

  it('email_inbound: returns ok=true without making network calls', async () => {
    const result = await runProbe('email_inbound', {})
    expect(result.ok).toBe(true)
    expect(result.message).toContain('IMAP')
  })

  // ── default / unknown type ─────────────────────────────────────────────────

  it('unknown type: returns ok=true with a "no active probe" message', async () => {
    const result = await runProbe('carrier_pigeon', {})
    expect(result.ok).toBe(true)
    expect(result.message).toContain('carrier_pigeon')
  })

  it('another unknown type: message includes the type name', async () => {
    const result = await runProbe('matrix', {})
    expect(result.message).toContain('matrix')
  })

  // ── whatsapp — missing credentials path ───────────────────────────────────

  it('whatsapp: returns ok=false when credentials are empty', async () => {
    const result = await runProbe('whatsapp', {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Missing')
  })

  it('whatsapp: returns ok=false when only phoneNumberId provided', async () => {
    const result = await runProbe('whatsapp', { phoneNumberId: '12345' })
    expect(result.ok).toBe(false)
  })

  it('whatsapp: returns ok=false when only accessToken provided', async () => {
    const result = await runProbe('whatsapp', { accessToken: 'EAAtest' })
    expect(result.ok).toBe(false)
  })

  // ── telegram — missing credentials path ───────────────────────────────────

  it('telegram: returns ok=false when botToken is missing', async () => {
    const result = await runProbe('telegram', {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain('botToken')
  })

  // ── sms — missing credentials path ────────────────────────────────────────

  it('sms: returns ok=false when credentials are empty', async () => {
    const result = await runProbe('sms', {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Missing')
  })

  it('sms: returns ok=false when only accountSid provided', async () => {
    const result = await runProbe('sms', { accountSid: 'ACtest' })
    expect(result.ok).toBe(false)
  })

  // ── email_outbound — no API key → SMTP mode message ───────────────────────

  it('email_outbound: returns ok=true with SMTP message when no apiKey', async () => {
    const result = await runProbe('email_outbound', {})
    expect(result.ok).toBe(true)
    expect(result.message).toContain('SMTP')
  })

  // ── discord — missing credentials path ────────────────────────────────────

  it('discord: returns ok=false when botToken is missing', async () => {
    const result = await runProbe('discord', {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain('botToken')
  })

  // ── slack — missing credentials path ──────────────────────────────────────

  it('slack: returns ok=false when botToken is missing', async () => {
    const result = await runProbe('slack', {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain('botToken')
  })

  // ── youtube_channel — missing channelId path ────────────────────────────

  it('youtube_channel: returns ok=false when channelId is missing', async () => {
    const result = await runProbe('youtube_channel', {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain('channelId')
  })

  it('youtube_channel: returns ok=false when channelId is empty string', async () => {
    const result = await runProbe('youtube_channel', { channelId: '  ' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('channelId')
  })

  // ── result shape ──────────────────────────────────────────────────────────

  it('always returns an object with ok (boolean) and message (string)', async () => {
    const result = await runProbe('email_inbound', {})
    expect(typeof result.ok).toBe('boolean')
    expect(typeof result.message).toBe('string')
  })
})
