/**
 * csvParser — Unit Tests
 *
 * parseCSV and parseJSON contact import utilities.
 */
import { describe, it, expect } from 'vitest'

import { parseCSV, parseJSON } from '@/utilities/csvParser'

// ── parseCSV ──────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('returns empty contacts and error for empty input', () => {
    const result = parseCSV('')
    expect(result.contacts).toHaveLength(0)
    expect(result.errors).toContain('Empty file')
  })

  it('parses a header+data row with email column', () => {
    const csv = 'email,name\nalice@example.com,Alice'
    const result = parseCSV(csv)
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0]!.email).toBe('alice@example.com')
    expect(result.contacts[0]!.name).toBe('Alice')
  })

  it('parses multiple rows', () => {
    const csv = 'email,name\nalice@example.com,Alice\nbob@example.com,Bob'
    const result = parseCSV(csv)
    expect(result.contacts).toHaveLength(2)
    expect(result.totalRows).toBe(2)
  })

  it('skips rows with invalid email and records error', () => {
    const csv = 'email,name\nnot-an-email,Bad\nbob@example.com,Bob'
    const result = parseCSV(csv)
    expect(result.contacts).toHaveLength(1)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/invalid email/i)
  })

  it('normalises email to lowercase', () => {
    const csv = 'email\nALICE@EXAMPLE.COM'
    const result = parseCSV(csv)
    expect(result.contacts[0]!.email).toBe('alice@example.com')
  })

  it('handles quoted CSV values', () => {
    const csv = 'email,name\n"alice@example.com","Alice, Smith"'
    const result = parseCSV(csv)
    expect(result.contacts[0]!.email).toBe('alice@example.com')
    expect(result.contacts[0]!.name).toBe('Alice, Smith')
  })

  it('parses sourceId column when present', () => {
    const csv = 'email,name,sourceId\nalice@example.com,Alice,src123'
    const result = parseCSV(csv)
    expect(result.contacts[0]!.sourceId).toBe('src123')
  })

  it('handles no-header CSV (first column treated as email)', () => {
    const csv = 'alice@example.com,Alice'
    const result = parseCSV(csv)
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0]!.email).toBe('alice@example.com')
  })

  it('skips empty rows gracefully', () => {
    const csv = 'email\nalice@example.com\n\n\nbob@example.com'
    const result = parseCSV(csv)
    expect(result.contacts).toHaveLength(2)
  })
})

// ── parseJSON ─────────────────────────────────────────────────────────────────

describe('parseJSON', () => {
  it('returns error for invalid JSON', () => {
    const result = parseJSON('{invalid}')
    expect(result.contacts).toHaveLength(0)
    expect(result.errors).toContain('Invalid JSON')
  })

  it('returns error when input is not an array', () => {
    const result = parseJSON('{"email":"a@b.com"}')
    expect(result.errors).toContain('Expected a JSON array')
  })

  it('parses array of objects with email field', () => {
    const json = JSON.stringify([{ email: 'alice@example.com', name: 'Alice' }])
    const result = parseJSON(json)
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0]!.email).toBe('alice@example.com')
    expect(result.contacts[0]!.name).toBe('Alice')
  })

  it('parses array of email strings', () => {
    const json = JSON.stringify(['alice@example.com', 'bob@example.com'])
    const result = parseJSON(json)
    expect(result.contacts).toHaveLength(2)
    expect(result.contacts[0]!.email).toBe('alice@example.com')
  })

  it('skips invalid email strings and records errors', () => {
    const json = JSON.stringify(['not-an-email', 'good@example.com'])
    const result = parseJSON(json)
    expect(result.contacts).toHaveLength(1)
    expect(result.errors.length).toBe(1)
  })

  it('parses Clerk export format', () => {
    const clerkExport = [{
      email_addresses: [{ email_address: 'clerk@example.com' }],
      first_name: 'Clerk',
      last_name: 'User',
      id: 'user_abc123',
    }]
    const result = parseJSON(JSON.stringify(clerkExport))
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0]!.email).toBe('clerk@example.com')
    expect(result.contacts[0]!.name).toBe('Clerk User')
    expect(result.contacts[0]!.sourceId).toBe('user_abc123')
  })

  it('normalises email to lowercase', () => {
    const json = JSON.stringify([{ email: 'UPPER@EXAMPLE.COM' }])
    const result = parseJSON(json)
    expect(result.contacts[0]!.email).toBe('upper@example.com')
  })

  it('returns 0 contacts for an empty array', () => {
    const result = parseJSON('[]')
    expect(result.contacts).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
    expect(result.totalRows).toBe(0)
  })
})
