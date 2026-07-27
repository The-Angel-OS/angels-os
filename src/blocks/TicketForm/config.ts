import type { Block } from 'payload'

/**
 * TicketForm — the customer-facing front door to the Tickets queue.
 *
 * ONE block, not one per flavour. A warranty claim and a return request differ
 * by which `type` they file and which words are on the button, so this is the
 * same block placed twice with a different `type` — mirroring the Tickets
 * collection itself, where `type` discriminates instead of three near-identical
 * collections. Adding "exchange" later is an option value, not a new block.
 *
 * @see src/collections/Tickets/index.ts
 */
export const TicketForm: Block = {
  slug: 'ticketForm',
  interfaceName: 'TicketFormBlock',
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'warranty',
      options: [
        { label: 'Warranty claim', value: 'warranty' },
        { label: 'Return request', value: 'return' },
        { label: 'Support request', value: 'support' },
        { label: 'Question', value: 'question' },
      ],
      admin: { description: 'Which kind of ticket this form files.' },
    },
    { name: 'heading', type: 'text', admin: { description: 'Defaults to a sensible title for the type.' } },
    {
      name: 'intro',
      type: 'textarea',
      admin: { description: 'One or two lines above the form. What they should have to hand.' },
    },
    {
      name: 'showOrderFields',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Order number, purchase date and where they bought it. Off for a general question.',
      },
    },
    {
      name: 'confirmation',
      type: 'textarea',
      admin: { description: 'Shown after a successful submission. Defaults to a plain acknowledgement.' },
    },
  ],
  labels: { plural: 'Ticket Forms', singular: 'Ticket Form' },
}
