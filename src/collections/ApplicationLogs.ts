import type { CollectionConfig } from 'payload'

/**
 * ApplicationLogs — Centralized error & event logging for the admin dashboard.
 *
 * Stores application errors, warnings, and informational events
 * that administrators can triage from the Error Log Viewer.
 *
 * System collection — NOT tenant-scoped (admins need full visibility).
 * Only super_admin / archangel / admin can read; system creates via overrideAccess.
 */
export const ApplicationLogs: CollectionConfig = {
  slug: 'application-logs',
  admin: {
    group: 'System',
    useAsTitle: 'message',
    defaultColumns: ['level', 'source', 'message', 'createdAt'],
  },
  access: {
    create: () => false, // System only (overrideAccess)
    read: ({ req }) => {
      const user = req.user as Record<string, unknown> | null
      const roles = Array.isArray(user?.roles) ? user.roles : []
      return (
        roles.includes('super_admin') ||
        roles.includes('archangel') ||
        roles.includes('admin')
      )
    },
    update: () => false,
    delete: ({ req }) => {
      const user = req.user as Record<string, unknown> | null
      const roles = Array.isArray(user?.roles) ? user.roles : []
      return roles.includes('super_admin')
    },
  },
  fields: [
    {
      name: 'level',
      type: 'select',
      required: true,
      defaultValue: 'error',
      options: [
        { label: 'Error', value: 'error' },
        { label: 'Warning', value: 'warning' },
        { label: 'Info', value: 'info' },
        { label: 'Debug', value: 'debug' },
      ],
      index: true,
      admin: {
        description: 'Severity level of the log entry',
      },
    },
    {
      name: 'source',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Component or module that generated the error (e.g., "useChat", "API /messages", "Footer")',
      },
    },
    {
      name: 'message',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable error description',
      },
    },
    {
      name: 'details',
      type: 'textarea',
      admin: {
        description: 'Stack trace, request body, or additional context',
      },
    },
    {
      name: 'statusCode',
      type: 'number',
      admin: {
        description: 'HTTP status code (if applicable)',
      },
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        description: 'Request URL or page URL where the error occurred',
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: {
        description: 'Browser user-agent string',
      },
    },
    {
      name: 'userId',
      type: 'text',
      admin: {
        description: 'ID of the user who triggered the error (if authenticated)',
      },
    },
    {
      name: 'tenantId',
      type: 'text',
      index: true,
      admin: {
        description: 'Tenant context when the error occurred',
      },
    },
    {
      name: 'resolved',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Mark as resolved after triage',
      },
    },
  ],
}
