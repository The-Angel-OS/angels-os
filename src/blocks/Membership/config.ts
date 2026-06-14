import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * Membership (Join) block — the member-facing mount of the recurring memberships/dues
 * engine. Lists the host endeavor's active plans (from the membership-plans settings
 * bag) and starts a Stripe Connect subscription checkout. The mirror of the Donation
 * block, but recurring: gyms, churches, makerspaces, Toastmasters — one engine.
 *
 * Plans are NOT configured here — they live per-endeavor (membershipPlans util) and
 * are fetched at runtime, so the same block works on every tenant's site.
 *
 * @see src/blocks/Membership/Component.tsx  @see src/utilities/membershipPlans.ts
 */
export const Membership: Block = {
  slug: 'membership',
  interfaceName: 'MembershipBlock',
  fields: [
    {
      name: 'richText',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: 'Description',
    },
    {
      name: 'ctaText',
      type: 'text',
      defaultValue: 'Become a member',
      admin: {
        description: 'Label on the final join button (e.g. "Join now", "Start membership").',
      },
    },
  ],
  labels: {
    plural: 'Membership / Join',
    singular: 'Membership / Join',
  },
}
