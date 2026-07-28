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
import { autoAnalyzeUpload } from './hooks/autoAnalyzeUpload'
import { mediaToAiBus } from './hooks/mediaToAiBus'
import { guardVideoUpload } from './hooks/guardVideoUpload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  admin: {
    group: 'Content',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'createdAt'],
    listSearchableFields: ['filename', 'alt', 'mimeType'],
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
    beforeValidate: [setTenantFromHeader, guardVideoUpload],
    // Analyze every upload (image vision / PDF text) → MediaMeta → RAG, so any
    // uploaded photo is deeply searchable later regardless of how it arrived.
    // Analyze the upload AND drop a message into the AI Bus `media` channel, so
    // every asset is both searchable and visible in the observable message flow.
    afterChange: [autoAnalyzeUpload, mediaToAiBus],
  },
  fields: [
    {
      // Who uploaded it. Set from the session, never from the request body.
      //
      // Media is tenant-scoped, which stops a CROSS-tenant read — but a public
      // upload surface (a customer's warranty photos) also needs to stop a
      // WITHIN-tenant one: without an owner, any signed-in customer could quote
      // another customer's media id back at a form and have it rendered to them
      // on their own ticket. Tenant scope alone cannot tell those two customers
      // apart. @see src/endpoints/tickets-ops.ts
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      // maxDepth 0 — return the id, never populate the user.
      //
      // Every media relation in the app is fetched at some depth, and a nested
      // relationship SPENDS that budget. Adding this field pushed deeply-nested
      // media (a product's gallery at depth 3) past the limit, so `gallery[].image`
      // started coming back as a bare ID instead of a document — and the product
      // page's Gallery renders `gallery[current].image` straight into <Media>.
      // Nothing here ever needs the populated user; ownership checks compare ids.
      maxDepth: 0,
      admin: { readOnly: true, position: 'sidebar' },
      hooks: {
        beforeChange: [
          ({ req, operation, value }) =>
            operation === 'create' ? (req?.user?.id ?? value ?? null) : value,
        ],
      },
    },
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
