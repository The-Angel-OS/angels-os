import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'
import { setTenantFromHeader } from './hooks/setTenantFromHeader'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  admin: {
    group: 'Content',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'createdAt'],
    description: 'Uploaded media assets — images, documents, and files for all tenant content.',
  },
  slug: 'media',
  access: {
    // Tenant-scoped: authenticated users filtered by multiTenantPlugin,
    // unauthenticated users scoped to current tenant via x-tenant-id header.
    read: publicWithTenantScope,
  },
  hooks: {
    // Fill `tenant` from the subdomain (x-tenant-id) when the client omits it —
    // fixes "failed to upload" on chat attachments for super_admins viewing a
    // tenant subdomain (no payload-tenant cookie). See hook for details.
    beforeValidate: [setTenantFromHeader],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../../public/media'),
    // Responsive image sizes — Payload auto-generates these on upload.
    // Existing uploads without these sizes will gracefully fall back to the original.
    imageSizes: [
      {
        name: 'thumbnail',
        width: 160,
        height: 160,
        position: 'centre',
      },
      {
        name: 'card',
        width: 480,
        height: undefined, // Preserve aspect ratio
      },
      {
        name: 'hero',
        width: 1440,
        height: undefined, // Preserve aspect ratio
      },
    ],
    focalPoint: true,
  },
}
