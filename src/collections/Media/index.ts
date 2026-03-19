import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

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
    // Generate responsive image variants for all uploads.
    // These are served by Next.js Image optimization but having Payload
    // pre-generate them ensures fast first-load and proper srcSet hints.
    imageSizes: [
      {
        name: 'thumbnail',
        width: 160,
        height: 160,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 70 } },
      },
      {
        name: 'card',
        width: 480,
        height: 480,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'hero',
        width: 1440,
        height: undefined, // Preserve aspect ratio
        formatOptions: { format: 'webp', options: { quality: 85 } },
      },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
}
