import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'

import { angelOsStripeAdapter } from '@/lib/angel-os-stripe-adapter'
import { routeFormToAIBus } from '@/hooks/routeFormToAIBus'
import { createFormSignatures } from '@/hooks/createFormSignatures'
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
  formBuilderPlugin({
    fields: {
      payment: false,
      // Custom: a binding e-signature field. The captured signature is stored in
      // the submission and turned into an immutable, tamper-evident Signatures row
      // by the createFormSignatures hook (server-side, with tenant context).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signature: {
        slug: 'signature',
        labels: { singular: 'Signature', plural: 'Signature Fields' },
        fields: [
          { name: 'name', type: 'text', required: true,
            admin: { description: 'Field name stored in the submission (e.g. waiver-signature).' } },
          { name: 'label', type: 'text' },
          { name: 'agreementText', type: 'textarea',
            admin: { description: 'Optional terms shown above the signature pad; the signer agrees to these (their hash pins the signature to this exact text).' } },
          { name: 'required', type: 'checkbox', defaultValue: true },
          { name: 'width', type: 'number' },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
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
        afterChange: [routeFormToAIBus, createFormSignatures],
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
