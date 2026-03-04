/**
 * messageContent — Unit Tests
 *
 * UMS content helpers: extractTextFromContent, wrapTextContent,
 * createSystemActionContent, createWidgetContent, createFormSubmissionContent,
 * createTransactionContent, createBIInsightContent, createVoiceCallContent
 */
import { describe, it, expect } from 'vitest'

import {
  extractTextFromContent,
  wrapTextContent,
  createSystemActionContent,
  createWidgetContent,
  createFormSubmissionContent,
  createTransactionContent,
  createBIInsightContent,
  createVoiceCallContent,
} from '@/utilities/messageContent'

// ── extractTextFromContent ─────────────────────────────────────────────────────

describe('extractTextFromContent', () => {
  it('returns empty string for null', () => {
    expect(extractTextFromContent(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(extractTextFromContent(undefined)).toBe('')
  })

  it('returns a plain string as-is', () => {
    expect(extractTextFromContent('Hello world')).toBe('Hello world')
  })

  it('extracts text from a UMS envelope', () => {
    const ums = { type: 'text', text: 'UMS message' }
    expect(extractTextFromContent(ums)).toBe('UMS message')
  })

  it('stringifies numbers', () => {
    expect(extractTextFromContent(42)).toBe('42')
  })

  it('stringifies booleans', () => {
    expect(extractTextFromContent(true)).toBe('true')
  })
})

// ── wrapTextContent ────────────────────────────────────────────────────────────

describe('wrapTextContent', () => {
  it('wraps a plain string into a UMS envelope', () => {
    const ums = wrapTextContent('Hello')
    expect(ums.type).toBe('text')
    expect(ums.text).toBe('Hello')
  })

  it('returns existing UMS envelope unchanged', () => {
    const existing = { type: 'text' as const, text: 'Existing' }
    const result = wrapTextContent(existing)
    expect(result.text).toBe('Existing')
  })

  it('sets type to text', () => {
    expect(wrapTextContent('test').type).toBe('text')
  })
})

// ── createSystemActionContent ──────────────────────────────────────────────────

describe('createSystemActionContent', () => {
  it('creates a system_action UMS envelope', () => {
    const ums = createSystemActionContent('Action summary', { type: 'some_action' })
    expect(ums.type).toBe('system_action')
    expect(ums.text).toBe('Action summary')
  })

  it('includes the action data', () => {
    const ums = createSystemActionContent('Test', { type: 'test', key: 'value' })
    expect(ums.actions).toBeDefined()
    expect(Array.isArray(ums.actions)).toBe(true)
  })
})

// ── createWidgetContent ────────────────────────────────────────────────────────

describe('createWidgetContent', () => {
  it('creates a widget UMS envelope', () => {
    const ums = createWidgetContent('Widget description', { widgetType: 'booking' })
    expect(ums.type).toBe('widget')
    expect(ums.text).toBe('Widget description')
  })
})

// ── createFormSubmissionContent ────────────────────────────────────────────────

describe('createFormSubmissionContent', () => {
  it('creates a form_submission UMS envelope', () => {
    const ums = createFormSubmissionContent('Form submitted', { field: 'value' })
    expect(ums.type).toBe('form_submission')
    expect(ums.text).toBe('Form submitted')
  })
})

// ── createTransactionContent ───────────────────────────────────────────────────

describe('createTransactionContent', () => {
  it('creates a transaction UMS envelope', () => {
    const ums = createTransactionContent('Order placed', { orderId: '123', amount: 5000 })
    expect(ums.type).toBe('transaction')
    expect(ums.text).toBe('Order placed')
  })
})

// ── createBIInsightContent ─────────────────────────────────────────────────────

describe('createBIInsightContent', () => {
  it('creates a bi_insight UMS envelope', () => {
    const ums = createBIInsightContent('Revenue up 10%', { metric: 'revenue', delta: 0.1 })
    expect(ums.type).toBe('bi_insight')
    expect(ums.text).toBe('Revenue up 10%')
  })
})

// ── createVoiceCallContent ─────────────────────────────────────────────────────

describe('createVoiceCallContent', () => {
  it('creates a voice_call UMS envelope', () => {
    const ums = createVoiceCallContent('Call started', { role: 'assistant', roomSid: 'RM123' })
    expect(ums.type).toBe('voice_call')
    expect(ums.text).toBe('Call started')
  })
})
