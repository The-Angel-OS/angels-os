import type { Block } from 'payload'

/**
 * MediaText — a two-column "text beside a video" section (the standard WordPress
 * marketing layout, e.g. NeuroCare Pro's "Why PLMT Is Different"). All-scalar
 * fields so the block's tables are a simple migration (no richText jsonb, no enum,
 * no sub-tables). v1 supports a video URL (YouTube/Vimeo); image support later.
 */
export const MediaText: Block = {
  slug: 'mediaText',
  interfaceName: 'MediaTextBlock',
  labels: { singular: 'Media + Text', plural: 'Media + Text' },
  fields: [
    { name: 'eyebrow', type: 'text', admin: { description: 'Small label above the heading (optional).' } },
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea', admin: { description: 'Paragraphs of copy. Blank lines separate paragraphs.' } },
    {
      // Uploads first: this is the one people actually reach for, and pasting a
      // Media URL into `videoUrl` only ever worked by accident (it rendered as a
      // raw <video src> and autoplayed). Image or video is decided by mimeType,
      // the same way the FullScreen and SplitPanel heroes do it.
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Image or video from your Media library. Takes precedence over the external URL below.' },
    },
    {
      name: 'videoUrl',
      type: 'text',
      admin: {
        description:
          'External video (YouTube or Vimeo). Used only when no Media is selected above.',
      },
    },
    { name: 'caption', type: 'text', admin: { description: 'Caption under the media (optional).' } },
    {
      name: 'videoOnRight',
      type: 'checkbox',
      defaultValue: true,
      // Column kept as `videoOnRight` — it's about which SIDE, not about video,
      // but renaming the column costs a migration for zero user-visible gain.
      label: 'Media on the right (uncheck to put it on the left)',
    },
    { name: 'ctaLabel', type: 'text', admin: { description: 'Button text (optional), e.g. "Read More".' } },
    { name: 'ctaUrl', type: 'text', admin: { description: 'Button link (optional).' } },
  ],
}
