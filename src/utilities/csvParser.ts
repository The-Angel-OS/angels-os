/**
 * CSV / JSON Contact Parser
 *
 * Lightweight parser for bulk contact import.
 * Handles email,name CSV format and [{email, name}] JSON arrays.
 * No external dependencies.
 */
import { isValidEmail } from './invitationSystem'

export interface ParsedContact {
  email: string
  name?: string
  sourceId?: string
}

export interface ParseResult {
  contacts: ParsedContact[]
  errors: string[]
  totalRows: number
}

/**
 * Parse CSV text into contacts.
 * Expects header row with at least an "email" column.
 * Falls back to treating first column as email, second as name.
 */
export function parseCSV(csvText: string): ParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { contacts: [], errors: ['Empty file'], totalRows: 0 }
  }

  const contacts: ParsedContact[] = []
  const errors: string[] = []

  // Detect header row
  const firstLine = lines[0]!.toLowerCase()
  const hasHeader = firstLine.includes('email')

  let emailIdx = 0
  let nameIdx = 1
  let sourceIdIdx = -1
  let startRow = 0

  if (hasHeader) {
    const headers = parseCSVRow(lines[0]!).map((h) => h.toLowerCase().trim())
    emailIdx = headers.indexOf('email')
    nameIdx = headers.indexOf('name')
    sourceIdIdx = headers.indexOf('sourceid') !== -1
      ? headers.indexOf('sourceid')
      : headers.indexOf('source_id') !== -1
        ? headers.indexOf('source_id')
        : headers.indexOf('id')
    if (emailIdx === -1) {
      emailIdx = 0 // fallback to first column
    }
    startRow = 1
  }

  const totalRows = lines.length - startRow

  for (let i = startRow; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]!)
    const email = (row[emailIdx] || '').trim().toLowerCase()

    if (!email) {
      errors.push(`Row ${i + 1}: empty email`)
      continue
    }

    if (!isValidEmail(email)) {
      errors.push(`Row ${i + 1}: invalid email "${email}"`)
      continue
    }

    const contact: ParsedContact = { email }

    const name = nameIdx >= 0 ? (row[nameIdx] || '').trim() : ''
    if (name) contact.name = name

    const sourceId = sourceIdIdx >= 0 ? (row[sourceIdIdx] || '').trim() : ''
    if (sourceId) contact.sourceId = sourceId

    contacts.push(contact)
  }

  return { contacts, errors, totalRows }
}

/**
 * Parse a single CSV row, handling quoted values.
 */
function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current)
  return result
}

/**
 * Parse JSON text into contacts.
 * Accepts:
 * - Array of objects: [{email, name?, sourceId?}]
 * - Array of strings: ["email1", "email2"]
 * - Clerk export format: [{email_addresses: [{email_address}], first_name, last_name, id}]
 */
export function parseJSON(jsonText: string): ParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { contacts: [], errors: ['Invalid JSON'], totalRows: 0 }
  }

  if (!Array.isArray(parsed)) {
    return { contacts: [], errors: ['Expected a JSON array'], totalRows: 0 }
  }

  const contacts: ParsedContact[] = []
  const errors: string[] = []
  const totalRows = parsed.length

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]

    // String format: just an email
    if (typeof item === 'string') {
      const email = item.trim().toLowerCase()
      if (isValidEmail(email)) {
        contacts.push({ email })
      } else {
        errors.push(`Item ${i + 1}: invalid email "${item}"`)
      }
      continue
    }

    // Object format
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>

      // Clerk export format detection
      let email: string | undefined
      let name: string | undefined
      let sourceId: string | undefined

      if (Array.isArray(obj.email_addresses) && obj.email_addresses.length > 0) {
        // Clerk format: { email_addresses: [{email_address: "..."}], first_name, last_name, id }
        const primary = obj.email_addresses[0] as Record<string, unknown>
        email = ((primary?.email_address as string) || '').trim().toLowerCase()
        const firstName = (obj.first_name as string) || ''
        const lastName = (obj.last_name as string) || ''
        name = [firstName, lastName].filter(Boolean).join(' ').trim() || undefined
        sourceId = (obj.id as string) || undefined
      } else {
        // Standard format: { email, name?, sourceId? }
        email = ((obj.email as string) || '').trim().toLowerCase()
        name = ((obj.name as string) || '').trim() || undefined
        sourceId = ((obj.sourceId as string) || (obj.source_id as string) || (obj.id as string) || '').trim() || undefined
      }

      if (!email || !isValidEmail(email)) {
        errors.push(`Item ${i + 1}: invalid or missing email`)
        continue
      }

      const contact: ParsedContact = { email }
      if (name) contact.name = name
      if (sourceId) contact.sourceId = sourceId
      contacts.push(contact)
      continue
    }

    errors.push(`Item ${i + 1}: unexpected format`)
  }

  return { contacts, errors, totalRows }
}
