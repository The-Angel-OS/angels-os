import type { Block } from 'payload'

/**
 * Video — a clip on its own in the flow, with nothing beside it.
 *
 * MediaText covers video BESIDE copy. This covers video that IS the section: a
 * testimonial, a how-to, a founder talking. Putting that through MediaText means
 * leaving the text side empty and fighting a two-column grid to centre one clip.
 *
 * Four fields on purpose. The reason to resist a second block type is the
 * million-block-types problem, and the reason this one earns its place is that
 * the alternative is a worse editing experience for the single most valuable
 * asset on the Kessela site — Stephanie, on camera, in portrait.
 */
export const Video: Block = {
  slug: 'video',
  interfaceName: 'VideoBlock',
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'Optional title above the video.' } },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Uploaded video file. Takes precedence over a URL.' },
    },
    {
      name: 'videoUrl',
      type: 'text',
      admin: {
        description: 'YouTube or Vimeo URL — used only when no file is uploaded.',
        condition: (_d, sibling) => !sibling?.media,
      },
    },
    {
      name: 'poster',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Still shown before play. Without one a video is a black rectangle, which nobody clicks.',
        condition: (_d, sibling) => Boolean(sibling?.media),
      },
    },
    {
      name: 'aspect',
      type: 'select',
      defaultValue: '16/9',
      options: [
        { label: 'Landscape 16:9', value: '16/9' },
        { label: 'Portrait 9:16 (phone video)', value: '9/16' },
        { label: 'Square 1:1', value: '1/1' },
      ],
    },
    { name: 'caption', type: 'text', admin: { description: 'Line under the video (optional).' } },
  ],
  labels: { plural: 'Videos', singular: 'Video' },
}
