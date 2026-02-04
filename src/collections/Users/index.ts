import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { publicAccess } from '@/access/publicAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { checkRole } from '@/access/utilities'

import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => checkRole(['super_admin', 'admin'], user),
    create: publicAccess,
    delete: adminOnly,
    read: adminOrSelf,
    update: adminOrSelf,
  },
  admin: {
    group: 'Users',
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 1209600,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'isSystemUser',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'LEO/AI avatar users. Do not log in; author Messages as ai_agent.',
        condition: (_, siblingData) => siblingData?.isSystemUser === true,
      },
    },
    {
      name: 'servesTenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        description: 'Tenant this agent serves (system users only)',
        condition: (_, siblingData) => siblingData?.isSystemUser === true,
      },
    },
    {
      name: 'agentConfig',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.isSystemUser === true,
        description: 'Configuration for AI/system agent behavior',
      },
      fields: [
        {
          name: 'agentType',
          type: 'select',
          options: [
            { label: 'LEO (General Assistant)', value: 'leo' },
            { label: 'Support Agent', value: 'support' },
            { label: 'Sales Agent', value: 'sales' },
            { label: 'Onboarding Guide', value: 'onboarding' },
            { label: 'Integration Agent', value: 'integration' },
            { label: 'Custom', value: 'custom' },
          ],
          defaultValue: 'leo',
          admin: {
            description: 'Type of agent - determines default behavior and routing',
          },
        },
        {
          name: 'displayName',
          type: 'text',
          admin: {
            description: 'Name shown in chat (e.g., "LEO", "Alex from Support")',
          },
        },
        {
          name: 'personality',
          type: 'textarea',
          admin: {
            description: 'System prompt / personality guidelines for this agent',
          },
        },
        {
          name: 'capabilities',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Query Posts', value: 'query_posts' },
            { label: 'Create Posts', value: 'create_posts' },
            { label: 'Update Posts', value: 'update_posts' },
            { label: 'Query Products', value: 'query_products' },
            { label: 'Create Products', value: 'create_products' },
            { label: 'Update Products', value: 'update_products' },
            { label: 'Query Pages', value: 'query_pages' },
            { label: 'Create Pages', value: 'create_pages' },
            { label: 'Update Pages', value: 'update_pages' },
            { label: 'Manage Categories', value: 'manage_categories' },
            { label: 'Manage Media', value: 'manage_media' },
            { label: 'Manage Navigation', value: 'manage_navigation' },
            { label: 'Create Orders', value: 'create_orders' },
            { label: 'Manage Spaces', value: 'manage_spaces' },
            { label: 'Send Emails', value: 'send_emails' },
            { label: 'Schedule Events', value: 'schedule_events' },
            { label: 'External API Calls', value: 'external_api' },
          ],
          admin: {
            description: 'What actions this agent can perform',
          },
        },
        {
          name: 'responseRules',
          type: 'json',
          admin: {
            description: 'Custom rules/conditions for response generation (JSON)',
          },
        },
        {
          name: 'handoffTo',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: 'Escalate to this user/agent when unable to help',
          },
        },
        {
          name: 'routingRules',
          type: 'group',
          admin: {
            description: 'Rules for when this agent should handle messages',
          },
          fields: [
            {
              name: 'channels',
              type: 'array',
              admin: {
                description: 'Channel slugs this agent monitors (e.g., "support", "sales")',
              },
              fields: [
                {
                  name: 'channelSlug',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'keywords',
              type: 'array',
              admin: {
                description: 'Keywords that trigger this agent',
              },
              fields: [
                {
                  name: 'keyword',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'isDefault',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Use this agent as default when no other matches',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        {
          label: 'super_admin',
          value: 'super_admin',
        },
        {
          label: 'admin',
          value: 'admin',
        },
        {
          label: 'customer',
          value: 'customer',
        },
      ],
    },
    {
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'cart',
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
  ],
}
