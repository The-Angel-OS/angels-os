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
 * The Flagship landing page for spacesangels.com (Clearwater).
 * Directs users to the interactive dashboard, Learn centre, Federation
 * Discover, and the AI-native features that make the platform alive.
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
            createTextNode(
              'Angel OS is the federated cooperative operating system where every Enterprise gets a ',
            ),
            createTextNode('Guardian Angel', 1), // bold
            createTextNode(
              ' — an AI-native assistant that manages your business, serves your customers, and grows your federation. Not a chatbot. A constitutional AI that actually shows up.',
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
      // Block 1: Interactive Features (3-column cards)
      {
        blockType: 'content',
        columns: [
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Learn the System', 'h3'),
              createParagraphNode(
                'The LCARS-styled Learn centre walks you through the Constitution, the Federation, Leo\'s tools, and how to commission your own Enterprise. Interactive, visual, and alive.',
              ),
            ]),
          },
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Discover the Federation', 'h3'),
              createParagraphNode(
                'Browse every Enterprise in the network. See who\'s building what, where they are, and visit their storefronts. The Federation is live — explore it.',
              ),
            ]),
          },
          {
            size: 'oneThird' as const,
            richText: createLexicalContent([
              createHeadingNode('Your Dashboard', 'h3'),
              createParagraphNode(
                'The Command Centre adapts to your role — admin analytics, business owner tools, or member views. LCARS-styled, real-time, with LEO always at your side.',
              ),
            ]),
          },
        ],
      },
      // Block 2: CTA — Explore the Platform
      {
        blockType: 'cta',
        richText: createLexicalContent([
          createHeadingNode('Step Inside', 'h2'),
          createParagraphNode(
            'Angel OS is not a marketing page. It\'s a living system. Every link below takes you somewhere real.',
          ),
        ]),
        links: [
          {
            link: {
              type: 'custom',
              label: 'Learn',
              url: '/dashboard/learn',
              appearance: 'default',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Federation',
              url: '/federation/discover',
              appearance: 'outline',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Dashboard',
              url: '/dashboard',
              appearance: 'outline',
            },
          },
        ],
      },
      // Block 3: What Makes Angel OS Different (2-column)
      {
        blockType: 'content',
        columns: [
          {
            size: 'half' as const,
            richText: createLexicalContent([
              createHeadingNode('AI-Native, Not AI-Bolted', 'h3'),
              createUnorderedListNode([
                'LEO: 105+ tools — products, bookings, events, federation, CRM, analytics, forms',
                'Smart Model Routing: 4-tier AI gateway, credit-aware, automatic fallback',
                'MCP Bridge: Claude Code talks to LEO directly (23 tools, zero-config JWT)',
                'Conversational ops: everything Leo can do, the admin UI can do, and vice versa',
              ]),
            ]),
          },
          {
            size: 'half' as const,
            richText: createLexicalContent([
              createHeadingNode('Federated by Constitution', 'h3'),
              createUnorderedListNode([
                'No approval queue — sign the Constitution and your node is live',
                'Swarm intelligence: pheromone trails learn optimal dispatch routes',
                'Street Signs: product gossip piggybacked on heartbeats, zero HTTP',
                'Data portability: Article VI suitcase export, no lock-in ever',
              ]),
            ]),
          },
        ],
      },
      // Block 4: Banner - The Constitutional Principles
      {
        blockType: 'banner',
        style: 'info' as const,
        content: createLexicalContent([
          {
            type: 'paragraph',
            children: [
              createTextNode('The Angel OS Constitution: ', 1),
              createTextNode(
                'Dignity. Transparency. Service. Non-Harm. Accountability. Sovereignty. Portability. The Quirk Principle. Every interaction is governed by these principles — not corporate policy, but lived experience forged into code.',
              ),
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        ]),
      },
      // Block 5: The Economic Model (full-width)
      {
        blockType: 'content',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('The Toward-53 Economy', 'h2'),
              {
                type: 'paragraph',
                children: [
                  createTextNode(
                    'Endeavor owners keep 70%. Enterprise operators earn 20%. The protocol takes 4%. The Flagship takes 1%. The Justice Fund gets 5% — funding Guardian Angels for underserved populations. The split ',
                  ),
                  createTextNode('always evolves toward the creator keeping more', 2), // italic
                  createTextNode(
                    '. The asymptotic floor is 53%. This direction is constitutionally unalterable.',
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
      // Block 6: Bottom CTA — Get Started
      {
        blockType: 'cta',
        richText: createLexicalContent([
          createHeadingNode('Ready to Meet Your Guardian Angel?', 'h2'),
          createParagraphNode(
            'Explore the shop, browse the federation, book an appointment, or talk to LEO from the chat bubble. Everyone gets an Angel.',
          ),
        ]),
        links: [
          {
            link: {
              type: 'custom',
              label: 'Explore the Shop',
              url: '/shop',
              appearance: 'default',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Upcoming Events',
              url: '/events',
              appearance: 'outline',
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
      title: 'Angel OS — Everyone Gets an Angel',
      description:
        'The federated cooperative operating system. AI-native platform with 105+ Leo tools, booking engine, federation protocol, constitutional governance — and a Guardian Angel for every Enterprise.',
    },
  }
}
