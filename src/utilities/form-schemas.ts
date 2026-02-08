// Form schemas using Zod for validation and auto-generation
import { z } from 'zod'

// Tenant provisioning schema
export const tenantProvisionSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  businessType: z.enum(['service', 'retail', 'creator', 'restaurant', 'other']),
  theme: z.enum(['business', 'minimal', 'corporate', 'creative', 'custom']).default('business'),
  features: z.array(z.enum(['basic', 'spaces', 'ecommerce', 'booking', 'crm', 'analytics'])).default(['basic', 'spaces']),
  revenue: z.object({
    model: z.enum(['subscription', 'one-time', 'hybrid']).default('subscription'),
    sharePercentage: z.number().min(0).max(100).default(10),
    minimumMonthly: z.number().min(0).default(0),
  }).optional(),
  voicePrompt: z.string()
    .describe('Describe your business in natural language')
    .optional(),
})

// Space creation schema
export const spaceCreationSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z.string().optional(),
  businessType: z.enum(['ecommerce', 'blog', 'portfolio', 'service', 'community']),
  features: z.object({
    ecommerce: z.boolean().default(false),
    booking: z.boolean().default(false),
    blog: z.boolean().default(true),
    crm: z.boolean().default(false),
    analytics: z.boolean().default(true),
  }),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color').default('#000000'),
    secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color').default('#ffffff'),
    logo: z.string().url().optional(),
    favicon: z.string().url().optional(),
  }),
})

// Payment request schema for Leo AI
export const paymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  recipient: z.string().email('Must be a valid email'),
  description: z.string().min(5, 'Description required'),
  invoiceId: z.string().optional(),
  dueDate: z.date().optional(),
})

// Inventory update schema
export const inventoryUpdateSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    currentCount: z.number().int().min(0),
    adjustedCount: z.number().int().min(0),
    reason: z.enum(['sale', 'restock', 'damage', 'theft', 'correction', 'photo_analysis']),
    photoUrl: z.string().url().optional(),
    confidence: z.number().min(0).max(100).optional(),
  })),
  location: z.string().optional(),
  notes: z.string().optional(),
  analyzedBy: z.enum(['human', 'ai', 'hybrid']).default('human'),
})

// Contact/Lead form schema
export const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  source: z.enum(['website', 'referral', 'social', 'advertisement', 'other']).default('website'),
  interests: z.array(z.string()).optional(),
})

// Karma invite schema
export const karmaInviteSchema = z.object({
  inviterEmail: z.string().email(),
  inviteeEmail: z.string().email(),
  inviteMessage: z.string().optional(),
  referralLevels: z.number().int().min(1).max(5).default(3),
  upstreamCutPercentage: z.number().min(0).max(50).default(10),
  bonusPoints: z.number().int().min(0).default(100),
})

// Dynamic form generation from voice prompt
export const voicePromptFormSchema = z.object({
  prompt: z.string().min(10, 'Please describe what kind of form you need'),
  formType: z.enum(['contact', 'survey', 'application', 'feedback', 'custom']),
  fields: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'email', 'number', 'date', 'select', 'checkbox', 'textarea', 'file']),
    label: z.string(),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(), // for select fields
    validation: z.any().optional(), // custom validation rules
  })).optional(),
})

// Product creation schema (for PoD/dropshipping)
export const productCreationSchema = z.object({
  name: z.string().min(2, 'Product name required'),
  description: z.string().min(10, 'Description required'),
  price: z.number().positive('Price must be positive'),
  category: z.string(),
  variants: z.array(z.object({
    name: z.string(),
    sku: z.string(),
    price: z.number().positive().optional(),
    stock: z.number().int().min(0).optional(),
    attributes: z.record(z.string(), z.string()).optional(), // size, color, etc.
  })).optional(),
  pod: z.object({
    provider: z.enum(['printful', 'printify', 'custom']).optional(),
    printSku: z.string().optional(),
    assetUrl: z.string().url().optional(),
    mockupUrls: z.array(z.string().url()).optional(),
  }).optional(),
  images: z.array(z.string().url()).min(1, 'At least one image required'),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
})

// Export type helpers
export type TenantProvisionData = z.infer<typeof tenantProvisionSchema>
export type SpaceCreationData = z.infer<typeof spaceCreationSchema>
export type PaymentRequestData = z.infer<typeof paymentRequestSchema>
export type InventoryUpdateData = z.infer<typeof inventoryUpdateSchema>
export type ContactFormData = z.infer<typeof contactFormSchema>
export type KarmaInviteData = z.infer<typeof karmaInviteSchema>
export type VoicePromptFormData = z.infer<typeof voicePromptFormSchema>
export type ProductCreationData = z.infer<typeof productCreationSchema>
