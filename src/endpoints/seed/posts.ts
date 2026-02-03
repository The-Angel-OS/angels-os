import type { Media } from '@/payload-types'

export type AngelOsPostData = {
  slug: string
  title: string
  excerpt?: string
  hero?: { type: 'lowImpact' | 'highImpact' | 'none' }
  layout: Array<Record<string, unknown>>
}

export function angelOsPostsData(metaImage?: Media | null): AngelOsPostData[] {
  return [
    {
      slug: 'welcome-to-angel-os',
      title: 'Welcome to Angel OS',
      excerpt: 'Introducing Angel OS – Sovereign Intelligence for your digital presence.',
      hero: { type: 'lowImpact' },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: {
                root: {
                  type: 'root',
                  children: [
                    {
                      type: 'paragraph',
                      children: [
                        {
                          type: 'text',
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                          text: 'Angel OS is an inversion of the Daemon – bringing sovereign intelligence to everyone. Each tenant has their own LEO (Learning, Engaging, Organizing) assistant that learns, engages, and organizes on their behalf.',
                          version: 1,
                        },
                      ],
                      direction: 'ltr',
                      format: '',
                      indent: 0,
                      version: 1,
                    },
                    {
                      type: 'paragraph',
                      children: [
                        {
                          type: 'text',
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                          text: 'Explore the Shop for products, join Spaces for community, and connect with LEO for AI-powered assistance.',
                          version: 1,
                        },
                      ],
                      direction: 'ltr',
                      format: '',
                      indent: 0,
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              },
              enableLink: false,
            },
          ],
        },
        { blockType: 'comments', heading: 'Comments' },
      ],
    },
    {
      slug: 'getting-started-with-spaces',
      title: 'Getting Started with Spaces',
      excerpt: 'Learn how to navigate and participate in Angel OS Spaces.',
      hero: { type: 'none' },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: {
                root: {
                  type: 'root',
                  children: [
                    {
                      type: 'paragraph',
                      children: [
                        {
                          type: 'text',
                          detail: 0,
                          format: 0,
                          mode: 'normal',
                          style: '',
                          text: 'Spaces are Discord-like workspaces where you can join channels, collaborate, and connect with LEO. Each tenant can have multiple Spaces – from community hubs to support channels.',
                          version: 1,
                        },
                      ],
                      direction: 'ltr',
                      format: '',
                      indent: 0,
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              },
              enableLink: false,
            },
          ],
        },
        { blockType: 'comments', heading: 'Comments' },
      ],
    },
  ]
}
