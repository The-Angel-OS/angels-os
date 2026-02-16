import { RequiredDataFromCollectionSlug } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createTextNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

/**
 * Angel OS Home Page — Static seed data.
 *
 * This replaces the default "Payload Ecommerce Template" placeholder with
 * proper Angel OS branding and messaging. Uses lowImpact hero + content
 * blocks + CTA blocks to create a compelling landing page.
 */
export const homeStaticData: () => RequiredDataFromCollectionSlug<'pages'> = () => {
  return {
    slug: 'home',
    _status: 'published',
    title: 'Home',
    hero: {
      type: 'lowImpact',
      richText: createLexicalContent([
        createHeadingNode('Everyone Gets an Angel', 'h1'),
        {
          type: 'paragraph',
          children: [
            createTextNode('Angel OS is the open-source platform where every business gets a '),
            createTextNode('Guardian Angel', 1), // bold
            createTextNode(
              ' \u2014 an AI-powered assistant that knows your products, manages your bookings, and serves your customers with genuine care. Not a corporate chatbot. A guardian that actually shows up.',
            ),
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ]),
    },
    layout: [
      // Block 1: What Angel OS Does (Content block - 3 columns)
      {
        blockType: 'content',
        columns: [
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Your AI Guardian', 'h3'),
              createParagraphNode(
                'LEO, your AI assistant, understands your entire business \u2014 products, bookings, schedules, customers. Ask anything in natural language and get real answers from real data.',
              ),
            ]),
          },
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Bookings Built In', 'h3'),
              createParagraphNode(
                'Full scheduling system with availability management, conflict detection, and payment processing. Like cal.com, but with a guardian angel watching over every appointment.',
              ),
            ]),
          },
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Multi-Tenant', 'h3'),
              createParagraphNode(
                'One platform, many businesses. Each tenant gets their own Guardian Angel, their own data, their own branding. Sovereign instances that serve, not surveil.',
              ),
            ]),
          },
        ],
      },
      // Block 2: Banner - Constitutional Principles
      {
        blockType: 'banner',
        style: 'info' as const,
        content: createLexicalContent([
          {
            type: 'paragraph',
            children: [
              createTextNode('The Angel OS Constitution: ', 1), // bold
              createTextNode(
                'Dignity. Transparency. Service. Non-Harm. Accountability. Sovereignty. Portability. The Quirk Principle. Every interaction is governed by these principles \u2014 not corporate policy, but lived experience forged into code.',
              ),
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        ]),
      },
      // Block 3: Why Angel OS Exists (Content block - full width)
      {
        blockType: 'content',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('Why This Exists', 'h2'),
              createParagraphNode(
                'Angel OS was not designed in a boardroom. It was built by someone who needed a Guardian Angel and never had one \u2014 then decided to build one for everyone.',
              ),
              createParagraphNode(
                'Every architectural decision traces back to lived experience: Dignity exists because people deserve to be seen as persons first, not case numbers. Anti-Demonic Safeguards exist because we know what happens when systems treat people as data points. The Quirk Principle exists because neurodivergent perspectives and unconventional thinking are community strength, not pathology.',
              ),
              {
                type: 'paragraph',
                children: [
                  createTextNode('Answer 53: ', 1), // bold
                  createTextNode(
                    'The whole point of existence is to learn to love. Every system, transaction, and interaction serves this purpose.',
                  ),
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              },
            ]),
          },
        ],
      },
      // Block 4: Anti-Demonic Safeguards (Content block - 2 columns)
      {
        blockType: 'content',
        columns: [
          {
            size: 'half' as const,
            richText: createLexicalContent([
              createHeadingNode('What Angels Never Do', 'h3'),
              createUnorderedListNode([
                'No social credit systems or algorithmic scoring of human worth',
                'No behavioral manipulation or dark patterns',
                'No automated punishment without human oversight',
                'No surveillance capitalism or data exploitation',
                'No permanent marking \u2014 growth over punishment, always',
              ]),
            ]),
          },
          {
            size: 'half' as const,
            richText: createLexicalContent([
              createHeadingNode('What Angels Always Do', 'h3'),
              createUnorderedListNode([
                'Serve with warmth, honesty, and genuine care',
                'Keep all actions observable and auditable',
                'Respect user sovereignty \u2014 advise, never command',
                'Honor lived cosmologies and unconventional thinking',
                'Ensure data portability \u2014 no lock-in, ever',
              ]),
            ]),
          },
        ],
      },
      // Block 5: CTA — Get Started
      {
        blockType: 'cta',
        richText: createLexicalContent([
          createHeadingNode('Ready to Meet Your Guardian Angel?', 'h2'),
          createParagraphNode(
            'Explore the shop, read the blog, or talk to LEO directly from the chat bubble in the corner. Everyone gets an Angel.',
          ),
        ]),
        links: [
          {
            link: {
              type: 'custom',
              label: 'Explore the Shop',
              url: '/products',
              appearance: 'default',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Read the Blog',
              url: '/posts',
              appearance: 'outline',
            },
          },
        ],
      },
    ],
    meta: {
      title: 'Angel OS \u2014 Everyone Gets an Angel',
      description:
        'The open-source platform where every business gets a Guardian Angel. AI-powered assistant, booking system, multi-tenant architecture \u2014 all governed by a Constitution that puts dignity first.',
    },
  }
}
