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
    {
      // A phone-shot testimonial is PORTRAIT. Forcing it into a 16:9 frame either
      // crops the person's head off or pillarboxes them into a stripe — which is
      // exactly the footage that matters most here.
      name: 'aspect',
      type: 'select',
      defaultValue: '16/9',
      options: [
        { label: 'Landscape 16:9', value: '16/9' },
        { label: 'Portrait 9:16 (phone video)', value: '9/16' },
        { label: 'Square 1:1', value: '1/1' },
        { label: 'Classic 4:3', value: '4/3' },
      ],
      admin: { description: 'Frame shape for the image or video.' },
    },
    { name: 'caption', type: 'text', admin: { description: 'Caption under the media (optional).' } },
    {
      name: 'width',
      type: 'select',
      defaultValue: 'split',
      options: [
        { label: 'Split — text beside the media', value: 'split' },
        { label: 'Full width — media across the page, text beneath', value: 'full' },
      ],
      admin: {
        description:
          'Full width is the one to use for a video you actually want watched: a 16:9 clip in a half-width column is small enough that people skip it.',
      },
    },
    {
      name: 'side',
      type: 'select',
      defaultValue: 'right',
      options: [
        { label: 'Media on the right', value: 'right' },
        { label: 'Media on the left', value: 'left' },
        { label: 'Alternate — flip from the Media + Text block above', value: 'alternate' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.width !== 'full',
        description:
          'Alternate zig-zags down the page automatically, so adding a section in the middle does not force you to re-flip every one below it.',
      },
    },
    {
      name: 'playback',
      type: 'select',
      defaultValue: 'player',
      options: [
        { label: 'Player — controls, visitor presses play (default)', value: 'player' },
        { label: 'Autoplay muted, with controls', value: 'autoplay' },
        { label: 'Ambient — muted loop, no controls', value: 'ambient' },
      ],
      admin: {
        description:
          'Applies to UPLOADED video only — an external YouTube/Vimeo embed brings its own player. Ambient has no pause button, so never use it for anything carrying a message.',
      },
    },
    {
      // Superseded by `side`. Kept and hidden because existing rows encode their
      // placement here and rewriting them buys nothing — the resolver reads it
      // only when `side` is empty.
      name: 'videoOnRight',
      type: 'checkbox',
      defaultValue: true,
      label: 'Media on the right (legacy — use Side instead)',
      admin: { hidden: true },
    },
    { name: 'ctaLabel', type: 'text', admin: { description: 'Button text (optional), e.g. "Read More".' } },
    { name: 'ctaUrl', type: 'text', admin: { description: 'Button link (optional).' } },
  ],
}
