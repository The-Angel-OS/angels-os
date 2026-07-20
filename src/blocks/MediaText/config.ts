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
      name: 'videoUrl',
      type: 'text',
      admin: { description: 'YouTube or Vimeo URL — shown beside the text. e.g. https://youtu.be/…' },
    },
    { name: 'caption', type: 'text', admin: { description: 'Caption under the video (optional).' } },
    {
      name: 'videoOnRight',
      type: 'checkbox',
      defaultValue: true,
      label: 'Video on the right (uncheck to put it on the left)',
    },
    { name: 'ctaLabel', type: 'text', admin: { description: 'Button text (optional), e.g. "Read More".' } },
    { name: 'ctaUrl', type: 'text', admin: { description: 'Button link (optional).' } },
  ],
}
