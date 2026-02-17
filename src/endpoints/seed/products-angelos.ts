/**
 * Angel OS service products for seed.
 * Replaces Payload template Hat/T-shirt with real-world service offerings.
 * No variants needed — services don't have size/color options.
 */
import type { Media, Category, Product } from '@/payload-types'
import { RequiredDataFromCollectionSlug } from 'payload'

/** Helper to build Lexical richText from plain paragraphs */
function buildProductRichText(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [
          { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
        ],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      })),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

type ProductArgs = {
  metaImage?: Media
  categories: Category[]
  relatedProducts?: Product[]
}

export const avEventPackageData: (args: ProductArgs) => RequiredDataFromCollectionSlug<'products'> = ({
  metaImage,
  categories,
  relatedProducts = [],
}) => ({
  title: 'Live Event AV Package',
  slug: 'av-event-package',
  _status: 'published',
  priceInUSDEnabled: true,
  priceInUSD: 250000,
  categories,
  relatedProducts,
  description: buildProductRichText([
    'Complete audio-visual production package for corporate events, conferences, and live productions.',
    'Includes professional sound system with wireless microphones and digital mixer, LED video wall (indoor or outdoor), stage lighting design, confidence monitors, and a certified technician for the duration of your event.',
    'Whether you\'re hosting a 50-person board meeting or a 500-person gala, this package scales to your needs. Hybrid and virtual streaming add-ons available.',
  ]),
  layout: [],
  gallery: [],
  meta: {
    title: 'Live Event AV Package | Angel OS',
    description: 'Complete audio-visual production package for corporate events. Sound, lighting, video walls, and certified technicians.',
    ...(metaImage ? { image: metaImage } : {}),
  },
})

export const itSecurityConsultationData: (args: ProductArgs) => RequiredDataFromCollectionSlug<'products'> = ({
  metaImage,
  categories,
  relatedProducts = [],
}) => ({
  title: 'IT Security Consultation',
  slug: 'it-security-consultation',
  _status: 'published',
  priceInUSDEnabled: true,
  priceInUSD: 35000,
  categories,
  relatedProducts,
  description: buildProductRichText([
    'One-on-one cybersecurity consultation with a certified IT professional.',
    'We assess your current security posture, identify vulnerabilities in your infrastructure, and provide a prioritized remediation roadmap. Covers network security, cloud configuration, access management, and compliance requirements.',
    'Ideal for small-to-medium businesses looking to strengthen their defenses without the overhead of a full-time security team.',
  ]),
  layout: [],
  gallery: [],
  meta: {
    title: 'IT Security Consultation | Angel OS',
    description: 'Professional cybersecurity assessment and remediation roadmap for your business infrastructure.',
    ...(metaImage ? { image: metaImage } : {}),
  },
})

export const aiStrategyWorkshopData: (args: ProductArgs) => RequiredDataFromCollectionSlug<'products'> = ({
  metaImage,
  categories,
  relatedProducts = [],
}) => ({
  title: 'AI Strategy Workshop',
  slug: 'ai-strategy-workshop',
  _status: 'published',
  priceInUSDEnabled: true,
  priceInUSD: 75000,
  categories,
  relatedProducts,
  description: buildProductRichText([
    'Half-day workshop for business leaders exploring practical AI adoption strategies.',
    'Covers current AI landscape, identifying high-impact use cases for your industry, building vs buying AI solutions, data readiness assessment, and creating an AI roadmap aligned with your business goals.',
    'Led by experienced consultants who have guided dozens of organizations through successful AI transformations. No buzzwords — just practical, actionable intelligence.',
  ]),
  layout: [],
  gallery: [],
  meta: {
    title: 'AI Strategy Workshop | Angel OS',
    description: 'Half-day workshop for business leaders on practical AI adoption. Actionable roadmap, no buzzwords.',
    ...(metaImage ? { image: metaImage } : {}),
  },
})
