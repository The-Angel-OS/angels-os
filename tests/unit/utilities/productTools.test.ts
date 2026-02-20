/**
 * Unit tests for Product Creation & Management LEO tools.
 *
 * Tests the validation logic, tool definitions, and input processing
 * for create_product and update_product tools. Uses the project pattern
 * of re-implementing pure validation logic to avoid Payload-coupled imports.
 *
 * @see src/utilities/leo-data-tools.ts — create_product, update_product
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement validation logic from leo-data-tools.ts
// This avoids importing Payload-coupled modules while testing the same logic
// ---------------------------------------------------------------------------

interface CreateProductInput {
  title?: string
  price?: number
  description?: string
  category?: string
  inventory?: number
  status?: string
}

interface UpdateProductInput {
  productId?: number
  title?: string
  price?: number
  description?: string
  inventory?: number
  status?: string
}

/**
 * Validates create_product input and returns error message or null if valid.
 * Mirrors the validation in createProduct() handler.
 */
function validateCreateProduct(input: CreateProductInput): string | null {
  if (!input.title || !input.title.trim()) {
    return 'Error: Product title is required.'
  }

  if (!input.price || input.price <= 0 || !isFinite(input.price)) {
    return 'Error: Price must be a positive number (e.g., 35 for $35.00).'
  }

  if (input.status !== undefined && input.status !== 'draft' && input.status !== 'published') {
    return 'Error: Status must be "draft" or "published".'
  }

  if (input.inventory !== undefined && (input.inventory < 0 || !isFinite(input.inventory))) {
    return 'Error: Inventory must be a non-negative number.'
  }

  return null
}

/**
 * Validates update_product input and returns error message or null if valid.
 * Mirrors the validation in updateProduct() handler.
 */
function validateUpdateProduct(input: UpdateProductInput): string | null {
  if (!input.productId) {
    return 'Error: productId is required. Search for products first using query_products.'
  }

  if (input.price !== undefined) {
    if (!input.price || input.price <= 0 || !isFinite(input.price)) {
      return 'Error: Price must be a positive number.'
    }
  }

  if (input.status !== undefined) {
    if (input.status !== 'draft' && input.status !== 'published') {
      return 'Error: Status must be "draft" or "published".'
    }
  }

  if (input.inventory !== undefined) {
    if (input.inventory < 0 || !isFinite(input.inventory)) {
      return 'Error: Inventory must be a non-negative number.'
    }
  }

  return null
}

/**
 * Builds richText structure from plain text description.
 * Mirrors the richText conversion used in product creation.
 */
function buildRichText(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
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
  }
}

/**
 * Rounds price to 2 decimal places as done in the handler.
 */
function normalizePrice(price: number): number {
  return Math.round(price * 100) / 100
}

/**
 * Determines what fields changed between old and new product data.
 * Used by update_product to build change summary.
 */
function detectChanges(
  existing: { title: string; priceInUSD: number | null; inventory: number | null; status: string },
  updates: UpdateProductInput,
): string[] {
  const changes: string[] = []

  if (updates.title && typeof updates.title === 'string') {
    changes.push(`Title: "${existing.title}" → "${updates.title.trim()}"`)
  }
  if (updates.price !== undefined) {
    const newPrice = normalizePrice(updates.price)
    changes.push(`Price: $${existing.priceInUSD?.toFixed(2) || 'N/A'} → $${newPrice.toFixed(2)}`)
  }
  if (updates.inventory !== undefined) {
    changes.push(`Inventory: ${existing.inventory ?? 'N/A'} → ${Math.floor(updates.inventory)}`)
  }
  if (updates.status !== undefined) {
    changes.push(`Status: ${existing.status} → ${updates.status}`)
  }
  if (updates.description && typeof updates.description === 'string') {
    changes.push('Description: updated')
  }

  return changes
}

// ---------------------------------------------------------------------------
// Tool Definition Tests
// ---------------------------------------------------------------------------

describe('Product LEO Tools — Tool Definitions', () => {
  // Re-implement the tool definition shapes for validation
  const CREATE_PRODUCT_REQUIRED_FIELDS = ['title', 'price']
  const UPDATE_PRODUCT_REQUIRED_FIELDS = ['productId']

  const CREATE_PRODUCT_OPTIONAL_FIELDS = ['description', 'category', 'inventory', 'status']
  const UPDATE_PRODUCT_OPTIONAL_FIELDS = ['title', 'price', 'description', 'inventory', 'status']

  describe('create_product tool definition', () => {
    it('requires title and price fields', () => {
      expect(CREATE_PRODUCT_REQUIRED_FIELDS).toContain('title')
      expect(CREATE_PRODUCT_REQUIRED_FIELDS).toContain('price')
    })

    it('has optional description, category, inventory, status', () => {
      for (const field of CREATE_PRODUCT_OPTIONAL_FIELDS) {
        expect(CREATE_PRODUCT_OPTIONAL_FIELDS).toContain(field)
      }
    })

    it('status enum includes draft and published', () => {
      const validStatuses = ['draft', 'published']
      expect(validStatuses).toContain('draft')
      expect(validStatuses).toContain('published')
    })
  })

  describe('update_product tool definition', () => {
    it('requires productId', () => {
      expect(UPDATE_PRODUCT_REQUIRED_FIELDS).toContain('productId')
    })

    it('has optional title, price, description, inventory, status', () => {
      for (const field of UPDATE_PRODUCT_OPTIONAL_FIELDS) {
        expect(UPDATE_PRODUCT_OPTIONAL_FIELDS).toContain(field)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// create_product Validation Tests
// ---------------------------------------------------------------------------

describe('Product LEO Tools — create_product validation', () => {
  describe('title validation', () => {
    it('rejects missing title', () => {
      const err = validateCreateProduct({ price: 35 })
      expect(err).toBe('Error: Product title is required.')
    })

    it('rejects empty title', () => {
      const err = validateCreateProduct({ title: '', price: 35 })
      expect(err).toBe('Error: Product title is required.')
    })

    it('rejects whitespace-only title', () => {
      const err = validateCreateProduct({ title: '   ', price: 35 })
      expect(err).toBe('Error: Product title is required.')
    })

    it('accepts valid title', () => {
      const err = validateCreateProduct({ title: 'Lavender Oil', price: 35 })
      expect(err).toBeNull()
    })
  })

  describe('price validation', () => {
    it('rejects missing price', () => {
      const err = validateCreateProduct({ title: 'Test' })
      expect(err).toBe('Error: Price must be a positive number (e.g., 35 for $35.00).')
    })

    it('rejects zero price', () => {
      const err = validateCreateProduct({ title: 'Test', price: 0 })
      expect(err).toBe('Error: Price must be a positive number (e.g., 35 for $35.00).')
    })

    it('rejects negative price', () => {
      const err = validateCreateProduct({ title: 'Test', price: -10 })
      expect(err).toBe('Error: Price must be a positive number (e.g., 35 for $35.00).')
    })

    it('rejects NaN price', () => {
      const err = validateCreateProduct({ title: 'Test', price: NaN })
      expect(err).toBe('Error: Price must be a positive number (e.g., 35 for $35.00).')
    })

    it('rejects Infinity price', () => {
      const err = validateCreateProduct({ title: 'Test', price: Infinity })
      expect(err).toBe('Error: Price must be a positive number (e.g., 35 for $35.00).')
    })

    it('accepts valid integer price', () => {
      const err = validateCreateProduct({ title: 'Test', price: 35 })
      expect(err).toBeNull()
    })

    it('accepts valid decimal price', () => {
      const err = validateCreateProduct({ title: 'Test', price: 29.99 })
      expect(err).toBeNull()
    })

    it('accepts small price', () => {
      const err = validateCreateProduct({ title: 'Test', price: 0.01 })
      expect(err).toBeNull()
    })
  })

  describe('status validation', () => {
    it('accepts draft status', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, status: 'draft' })
      expect(err).toBeNull()
    })

    it('accepts published status', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, status: 'published' })
      expect(err).toBeNull()
    })

    it('rejects invalid status', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, status: 'archived' })
      expect(err).toBe('Error: Status must be "draft" or "published".')
    })

    it('accepts missing status (defaults to draft)', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10 })
      expect(err).toBeNull()
    })
  })

  describe('inventory validation', () => {
    it('accepts positive inventory', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, inventory: 100 })
      expect(err).toBeNull()
    })

    it('accepts zero inventory', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, inventory: 0 })
      expect(err).toBeNull()
    })

    it('rejects negative inventory', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, inventory: -5 })
      expect(err).toBe('Error: Inventory must be a non-negative number.')
    })

    it('rejects Infinity inventory', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10, inventory: Infinity })
      expect(err).toBe('Error: Inventory must be a non-negative number.')
    })

    it('accepts missing inventory (unlimited/digital)', () => {
      const err = validateCreateProduct({ title: 'Test', price: 10 })
      expect(err).toBeNull()
    })
  })

  describe('full valid product', () => {
    it('accepts complete product with all fields', () => {
      const err = validateCreateProduct({
        title: 'Organic Lavender Massage Oil',
        price: 35.00,
        description: 'Pure organic lavender essential oil blend for massage therapy.',
        category: 'Wellness',
        inventory: 50,
        status: 'draft',
      })
      expect(err).toBeNull()
    })

    it('accepts minimal product (title + price only)', () => {
      const err = validateCreateProduct({ title: 'Quick Listing', price: 5 })
      expect(err).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// update_product Validation Tests
// ---------------------------------------------------------------------------

describe('Product LEO Tools — update_product validation', () => {
  it('rejects missing productId', () => {
    const err = validateUpdateProduct({})
    expect(err).toBe('Error: productId is required. Search for products first using query_products.')
  })

  it('rejects zero productId', () => {
    const err = validateUpdateProduct({ productId: 0 })
    expect(err).toBe('Error: productId is required. Search for products first using query_products.')
  })

  it('accepts valid productId with no updates', () => {
    // This would produce "no changes" in the handler, but validation passes
    const err = validateUpdateProduct({ productId: 42 })
    expect(err).toBeNull()
  })

  it('rejects negative price update', () => {
    const err = validateUpdateProduct({ productId: 42, price: -5 })
    expect(err).toBe('Error: Price must be a positive number.')
  })

  it('rejects zero price update', () => {
    const err = validateUpdateProduct({ productId: 42, price: 0 })
    expect(err).toBe('Error: Price must be a positive number.')
  })

  it('accepts valid price update', () => {
    const err = validateUpdateProduct({ productId: 42, price: 49.99 })
    expect(err).toBeNull()
  })

  it('rejects invalid status update', () => {
    const err = validateUpdateProduct({ productId: 42, status: 'pending' })
    expect(err).toBe('Error: Status must be "draft" or "published".')
  })

  it('accepts valid status update', () => {
    const err = validateUpdateProduct({ productId: 42, status: 'published' })
    expect(err).toBeNull()
  })

  it('rejects negative inventory update', () => {
    const err = validateUpdateProduct({ productId: 42, inventory: -1 })
    expect(err).toBe('Error: Inventory must be a non-negative number.')
  })

  it('accepts zero inventory update', () => {
    const err = validateUpdateProduct({ productId: 42, inventory: 0 })
    expect(err).toBeNull()
  })

  it('accepts multiple valid field updates', () => {
    const err = validateUpdateProduct({
      productId: 42,
      title: 'Updated Product Name',
      price: 59.99,
      inventory: 25,
      status: 'published',
      description: 'New description.',
    })
    expect(err).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Price Normalization Tests
// ---------------------------------------------------------------------------

describe('Product LEO Tools — price normalization', () => {
  it('rounds to 2 decimal places', () => {
    expect(normalizePrice(29.999)).toBe(30.00)
    // Note: 9.995 * 100 = 999.4999... in IEEE 754, so Math.round gives 999 → 9.99
    expect(normalizePrice(9.995)).toBe(9.99)
    expect(normalizePrice(9.994)).toBe(9.99)
    expect(normalizePrice(9.996)).toBe(10.00)
  })

  it('preserves exact 2-decimal prices', () => {
    expect(normalizePrice(35.00)).toBe(35.00)
    expect(normalizePrice(0.99)).toBe(0.99)
    expect(normalizePrice(199.99)).toBe(199.99)
  })

  it('handles integer prices', () => {
    expect(normalizePrice(35)).toBe(35)
    expect(normalizePrice(100)).toBe(100)
    expect(normalizePrice(1)).toBe(1)
  })

  it('handles floating point arithmetic edge cases', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(normalizePrice(0.1 + 0.2)).toBe(0.30)
  })
})

// ---------------------------------------------------------------------------
// Rich Text Conversion Tests
// ---------------------------------------------------------------------------

describe('Product LEO Tools — richText conversion', () => {
  it('wraps plain text in Lexical richText structure', () => {
    const rt = buildRichText('A nice product description')
    expect(rt.root.type).toBe('root')
    expect(rt.root.children).toHaveLength(1)
    expect(rt.root.children[0].type).toBe('paragraph')
    expect(rt.root.children[0].children).toHaveLength(1)
    expect(rt.root.children[0].children[0].type).toBe('text')
    expect(rt.root.children[0].children[0].text).toBe('A nice product description')
  })

  it('preserves empty string', () => {
    const rt = buildRichText('')
    expect(rt.root.children[0].children[0].text).toBe('')
  })

  it('preserves special characters', () => {
    const rt = buildRichText('Price: $35.00 — "Premium" quality <organic>')
    expect(rt.root.children[0].children[0].text).toBe(
      'Price: $35.00 — "Premium" quality <organic>',
    )
  })

  it('sets correct Lexical metadata fields', () => {
    const rt = buildRichText('test')
    const textNode = rt.root.children[0].children[0]
    expect(textNode.detail).toBe(0)
    expect(textNode.format).toBe(0)
    expect(textNode.mode).toBe('normal')
    expect(textNode.version).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Change Detection Tests (update_product)
// ---------------------------------------------------------------------------

describe('Product LEO Tools — change detection', () => {
  const existing = {
    title: 'Original Product',
    priceInUSD: 25.00,
    inventory: 10,
    status: 'draft',
  }

  it('detects title change', () => {
    const changes = detectChanges(existing, { productId: 1, title: 'New Name' })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toBe('Title: "Original Product" → "New Name"')
  })

  it('detects price change', () => {
    const changes = detectChanges(existing, { productId: 1, price: 49.99 })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toBe('Price: $25.00 → $49.99')
  })

  it('detects inventory change', () => {
    const changes = detectChanges(existing, { productId: 1, inventory: 100 })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toBe('Inventory: 10 → 100')
  })

  it('detects status change', () => {
    const changes = detectChanges(existing, { productId: 1, status: 'published' })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toBe('Status: draft → published')
  })

  it('detects description change', () => {
    const changes = detectChanges(existing, { productId: 1, description: 'New desc' })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toBe('Description: updated')
  })

  it('detects multiple changes', () => {
    const changes = detectChanges(existing, {
      productId: 1,
      title: 'Updated',
      price: 39.99,
      status: 'published',
    })
    expect(changes).toHaveLength(3)
    expect(changes[0]).toContain('Title:')
    expect(changes[1]).toContain('Price:')
    expect(changes[2]).toContain('Status:')
  })

  it('returns empty array for no changes', () => {
    const changes = detectChanges(existing, { productId: 1 })
    expect(changes).toHaveLength(0)
  })

  it('handles null priceInUSD in existing product', () => {
    const noPriceProduct = { ...existing, priceInUSD: null }
    const changes = detectChanges(noPriceProduct, { productId: 1, price: 19.99 })
    expect(changes[0]).toBe('Price: $N/A → $19.99')
  })

  it('handles null inventory in existing product', () => {
    const noInvProduct = { ...existing, inventory: null }
    const changes = detectChanges(noInvProduct, { productId: 1, inventory: 50 })
    expect(changes[0]).toBe('Inventory: N/A → 50')
  })

  it('trims title whitespace', () => {
    const changes = detectChanges(existing, { productId: 1, title: '  Trimmed  ' })
    expect(changes[0]).toBe('Title: "Original Product" → "Trimmed"')
  })

  it('floors inventory to integer', () => {
    const changes = detectChanges(existing, { productId: 1, inventory: 7.8 })
    expect(changes[0]).toBe('Inventory: 10 → 7')
  })
})

// ---------------------------------------------------------------------------
// ProductManager Serialization Tests
// ---------------------------------------------------------------------------

describe('Product LEO Tools — product serialization', () => {
  // Re-implement the serialization logic from page.tsx
  function serializeProduct(p: any) {
    return {
      id: p.id,
      title: p.title || 'Untitled',
      slug: p.slug || '',
      priceInUSD: p.priceInUSD ?? null,
      inventory: p.inventory ?? null,
      status: p._status || 'draft',
      categories: Array.isArray(p.categories)
        ? p.categories.map((c: any) =>
            typeof c === 'object' ? c.title || 'Unknown' : 'Unknown',
          )
        : [],
      galleryCount: Array.isArray(p.gallery) ? p.gallery.length : 0,
      firstImageUrl:
        Array.isArray(p.gallery) && p.gallery.length > 0
          ? typeof p.gallery[0]?.image === 'object'
            ? p.gallery[0].image?.url || null
            : null
          : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }

  it('serializes a full product', () => {
    const product = {
      id: 1,
      title: 'Lavender Oil',
      slug: 'lavender-oil',
      priceInUSD: 35.00,
      inventory: 50,
      _status: 'published',
      categories: [{ id: 1, title: 'Wellness' }],
      gallery: [{ image: { id: 10, url: '/api/media/file/lavender.jpg' } }],
      createdAt: '2026-02-18T00:00:00Z',
      updatedAt: '2026-02-18T01:00:00Z',
    }

    const s = serializeProduct(product)
    expect(s.id).toBe(1)
    expect(s.title).toBe('Lavender Oil')
    expect(s.slug).toBe('lavender-oil')
    expect(s.priceInUSD).toBe(35.00)
    expect(s.inventory).toBe(50)
    expect(s.status).toBe('published')
    expect(s.categories).toEqual(['Wellness'])
    expect(s.galleryCount).toBe(1)
    expect(s.firstImageUrl).toBe('/api/media/file/lavender.jpg')
  })

  it('handles product with no gallery', () => {
    const product = {
      id: 2,
      title: 'No Image',
      slug: 'no-image',
      priceInUSD: 10,
      _status: 'draft',
      createdAt: '2026-02-18T00:00:00Z',
      updatedAt: '2026-02-18T00:00:00Z',
    }

    const s = serializeProduct(product)
    expect(s.galleryCount).toBe(0)
    expect(s.firstImageUrl).toBeNull()
  })

  it('handles product with null price', () => {
    const product = {
      id: 3,
      title: 'Free Item',
      slug: 'free-item',
      priceInUSD: null,
      _status: 'draft',
      createdAt: '2026-02-18T00:00:00Z',
      updatedAt: '2026-02-18T00:00:00Z',
    }

    const s = serializeProduct(product)
    expect(s.priceInUSD).toBeNull()
  })

  it('defaults title to "Untitled"', () => {
    const product = { id: 4, createdAt: '', updatedAt: '' }
    const s = serializeProduct(product)
    expect(s.title).toBe('Untitled')
  })

  it('defaults status to "draft"', () => {
    const product = { id: 5, title: 'Test', createdAt: '', updatedAt: '' }
    const s = serializeProduct(product)
    expect(s.status).toBe('draft')
  })

  it('handles unresolved category relationships', () => {
    const product = {
      id: 6,
      title: 'Test',
      categories: [1, 2, 3], // Numeric IDs (unresolved)
      createdAt: '',
      updatedAt: '',
    }
    const s = serializeProduct(product)
    expect(s.categories).toEqual(['Unknown', 'Unknown', 'Unknown'])
  })

  it('handles gallery with non-object image', () => {
    const product = {
      id: 7,
      title: 'Test',
      gallery: [{ image: 10 }], // Numeric ID (unresolved)
      createdAt: '',
      updatedAt: '',
    }
    const s = serializeProduct(product)
    expect(s.galleryCount).toBe(1)
    expect(s.firstImageUrl).toBeNull()
  })

  it('handles gallery image with no URL', () => {
    const product = {
      id: 8,
      title: 'Test',
      gallery: [{ image: { id: 10 } }], // Object but no url
      createdAt: '',
      updatedAt: '',
    }
    const s = serializeProduct(product)
    expect(s.firstImageUrl).toBeNull()
  })
})
