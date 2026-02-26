import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * Calendar Block — embeddable event calendar for pages, posts, and products.
 *
 * Supports two modes:
 *   1. Manual events — author defines events directly in the block
 *   2. Product events — pulls from Products collection (category=events)
 *
 * Renders as an interactive month/list calendar with event cards.
 */
export const Calendar: Block = {
  slug: 'calendar',
  interfaceName: 'CalendarBlock',
  labels: {
    singular: 'Calendar',
    plural: 'Calendars',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: {
        description: 'Optional heading above the calendar (e.g., "Tour Dates", "Upcoming Events")',
      },
    },
    {
      name: 'description',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
      admin: {
        description: 'Optional description text below the heading',
      },
    },
    {
      name: 'sourceType',
      type: 'select',
      defaultValue: 'manual',
      required: true,
      options: [
        { label: 'Manual Events', value: 'manual' },
        { label: 'From Products (events)', value: 'products' },
      ],
      admin: {
        description: 'Where to pull events from',
      },
    },
    // ─── Manual events ──────────────────────────────────────────
    {
      name: 'events',
      type: 'array',
      label: 'Events',
      admin: {
        description: 'Define events manually',
        condition: (_, siblingData) => siblingData?.sourceType === 'manual',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          admin: { description: 'Event title (e.g., "LIVE: Cleveland OH — Grog Shop")' },
        },
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            date: { pickerAppearance: 'dayOnly' },
            description: 'Event date',
          },
        },
        {
          name: 'time',
          type: 'text',
          admin: { description: 'Event time (e.g., "8:00 PM", "Doors at 7")', placeholder: '8:00 PM' },
        },
        {
          name: 'venue',
          type: 'text',
          admin: { description: 'Venue name' },
        },
        {
          name: 'location',
          type: 'text',
          admin: { description: 'City, State (e.g., "Cleveland, OH")' },
        },
        {
          name: 'description',
          type: 'textarea',
          admin: { description: 'Short description or notes' },
        },
        {
          name: 'ticketUrl',
          type: 'text',
          admin: { description: 'Link to buy tickets (external URL or product slug)' },
        },
        {
          name: 'soldOut',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Mark as sold out' },
        },
        {
          name: 'featured',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Highlight this event' },
        },
      ],
    },
    // ─── Product-sourced events ──────────────────────────────────
    {
      name: 'productCategory',
      type: 'text',
      defaultValue: 'events',
      admin: {
        description: 'Product category to pull events from (matches product slug prefix or category field)',
        condition: (_, siblingData) => siblingData?.sourceType === 'products',
      },
    },
    {
      name: 'maxEvents',
      type: 'number',
      defaultValue: 20,
      admin: {
        description: 'Maximum number of events to display',
      },
    },
    // ─── Display options ────────────────────────────────────────
    {
      name: 'defaultView',
      type: 'select',
      defaultValue: 'list',
      options: [
        { label: 'List View', value: 'list' },
        { label: 'Month Grid', value: 'month' },
      ],
      admin: {
        description: 'Default calendar view',
      },
    },
    {
      name: 'showPastEvents',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show events that have already passed',
      },
    },
    {
      name: 'accentColor',
      type: 'text',
      admin: {
        description: 'Accent color for event highlights (hex, e.g., #E94560). Falls back to tenant branding.',
        placeholder: '#E94560',
      },
    },
  ],
}
