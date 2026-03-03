/**
 * bridgeHelpers — Unit Tests
 *
 * Pure lookup functions: getSourceIcon, getChannelSource, getMessageType
 */
import { describe, it, expect } from 'vitest'

import {
  getSourceIcon,
  getChannelSource,
  getMessageType,
} from '@/utilities/bridgeHelpers'

// ── getSourceIcon ─────────────────────────────────────────────────────────────

describe('getSourceIcon', () => {
  it('returns 📱 for whatsapp', () => {
    expect(getSourceIcon('whatsapp')).toBe('📱')
  })

  it('returns 🎮 for discord', () => {
    expect(getSourceIcon('discord')).toBe('🎮')
  })

  it('returns ✈️ for telegram', () => {
    expect(getSourceIcon('telegram')).toBe('✈️')
  })

  it('returns 📲 for sms', () => {
    expect(getSourceIcon('sms')).toBe('📲')
  })

  it('returns 📧 for email', () => {
    expect(getSourceIcon('email')).toBe('📧')
  })

  it('returns 💼 for slack', () => {
    expect(getSourceIcon('slack')).toBe('💼')
  })

  it('returns default 📨 for unknown source', () => {
    expect(getSourceIcon('unknown_platform')).toBe('📨')
  })

  it('returns default for empty string', () => {
    expect(getSourceIcon('')).toBe('📨')
  })
})

// ── getChannelSource ──────────────────────────────────────────────────────────

describe('getChannelSource', () => {
  it('returns "whatsapp" for whatsapp', () => {
    expect(getChannelSource('whatsapp')).toBe('whatsapp')
  })

  it('returns "discord" for discord', () => {
    expect(getChannelSource('discord')).toBe('discord')
  })

  it('returns "telegram" for telegram', () => {
    expect(getChannelSource('telegram')).toBe('telegram')
  })

  it('returns "native" for webhook', () => {
    expect(getChannelSource('webhook')).toBe('native')
  })

  it('returns "native" for unknown source', () => {
    expect(getChannelSource('some_unknown')).toBe('native')
  })

  it('returns "sms" for sms', () => {
    expect(getChannelSource('sms')).toBe('sms')
  })
})

// ── getMessageType ────────────────────────────────────────────────────────────

describe('getMessageType', () => {
  it('returns "whatsapp_message" for whatsapp', () => {
    expect(getMessageType('whatsapp')).toBe('whatsapp_message')
  })

  it('returns "discord_message" for discord', () => {
    expect(getMessageType('discord')).toBe('discord_message')
  })

  it('returns "telegram_message" for telegram', () => {
    expect(getMessageType('telegram')).toBe('telegram_message')
  })

  it('returns "sms_message" for sms', () => {
    expect(getMessageType('sms')).toBe('sms_message')
  })

  it('returns "email_message" for email', () => {
    expect(getMessageType('email')).toBe('email_message')
  })

  it('returns "user" for webhook', () => {
    expect(getMessageType('webhook')).toBe('user')
  })

  it('returns "slack_message" for slack', () => {
    expect(getMessageType('slack')).toBe('slack_message')
  })

  it('returns "user" for unknown source', () => {
    expect(getMessageType('unknown')).toBe('user')
  })
})
