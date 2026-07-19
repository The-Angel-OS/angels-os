import type { Block } from 'payload'

export const GoogleReviews: Block = {
  slug: 'googleReviews',
  interfaceName: 'GoogleReviewsBlock',
  labels: { singular: 'Google Reviews', plural: 'Google Reviews' },
  fields: [
    {
      name: 'placeId',
      type: 'text',
      required: true,
      admin: {
        description:
          'The business Google Place ID (find it at developers.google.com/maps/documentation/places/web-service/place-id). A pasted Google Maps URL with ?place_id= also works.',
      },
    },
    {
      name: 'heading',
      type: 'text',
      admin: { description: 'Optional section heading, e.g. "What our customers say".' },
    },
    {
      name: 'maxReviews',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 5,
      admin: { description: 'How many reviews to show (Google returns up to 5).' },
    },
    {
      name: 'minRating',
      type: 'number',
      defaultValue: 4,
      min: 1,
      max: 5,
      admin: { description: 'Only show reviews at or above this star rating.' },
    },
    {
      name: 'showAggregate',
      type: 'checkbox',
      defaultValue: true,
      label: 'Show overall rating + review count',
    },
    // ponytail: grid-only for Slice 1 — a layout select would add per-collection
    // enum types (main + version) to the migration for little gain. Add in Slice 2.
  ],
}
