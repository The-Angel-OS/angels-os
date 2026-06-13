import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { angelOsStripeAdapter } from '@/lib/angel-os-stripe-adapter'
import { routeFormToAIBus } from '@/hooks/routeFormToAIBus'
import { angelOsEmailLayout } from '@/utilities/angelOsEmailLayout'

import { Page, Product } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { OrdersCollection } from '@/collections/Orders'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Payload Ecommerce Template` : 'Payload Ecommerce Template'
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  // One-level (and beyond) page hierarchy: adds `parent` + auto `breadcrumbs` to
  // Pages. Drives the hierarchical Home menu (a child page hangs under its parent).
  // ⚠️ Adds pages.parent_id + the pages_breadcrumbs table — provision those columns
  // on every prod DB (ensure-pages-nav-columns) BEFORE deploying this.
  nestedDocsPlugin({
    collections: ['pages'],
    generateLabel: (_, doc) => (doc?.title as string) || '',
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${(doc?.slug as string) || ''}`, ''),
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    // Wrap every Form Builder submission email in the shared Angel OS branded
    // shell (green "A" mark + "Powered by Angel OS" footer) so a contact/lead
    // form notification looks like the rest of our mail, not raw plugin HTML.
    beforeEmail: (emails) =>
      emails.map((email) => ({
        ...email,
        html: angelOsEmailLayout({
          heading: email.subject,
          bodyHtml: email.html,
        }),
      })),
    formSubmissionOverrides: {
      admin: {
        group: 'Content',
      },
      hooks: {
        afterChange: [routeFormToAIBus],
      },
    },
    formOverrides: {
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    customers: {
      slug: 'users',
    },
    payments: {
      paymentMethods: [
        angelOsStripeAdapter({
          secretKey: process.env.STRIPE_SECRET_KEY!,
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET!,
        }),
      ],
    },
    orders: {
      ordersCollectionOverride: OrdersCollection,
    },
    products: {
      productsCollectionOverride: ProductsCollection,
    },
  }),
]
