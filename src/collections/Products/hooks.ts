/**
 * Constitutional Hooks for Products Collection
 * 
 * These hooks create observable AI Bus messages for product changes,
 * enabling external Angels to monitor and respond to inventory events
 * without giving the Core platform dangerous capabilities.
 * 
 * Distributed Intelligence Pattern:
 * - Core: Creates observable messages (safe)
 * - Angels: Take action based on messages (powerful but bounded)
 * 
 * Constitutional Reference: Article IV - AI Bus Protocol
 */

import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'

interface ProductInventoryChange {
  productId: string
  productTitle: string
  previousInventory: number | null
  currentInventory: number
  change: number
  timestamp: Date
  threshold?: number
}

/**
 * After product changes, create observable AI Bus message
 * External Angels can monitor these and take action (reorder, notify, etc.)
 */
export const afterProductChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  // Only track inventory changes
  if (!doc.inventory && !previousDoc?.inventory) return
  
  const previousInventory = previousDoc?.inventory || 0
  const currentInventory = doc.inventory || 0
  
  // Skip if no actual change
  if (previousInventory === currentInventory && operation === 'update') return
  
  const change = currentInventory - previousInventory
  const tenantId = typeof doc.tenant === 'string' ? doc.tenant : doc.tenant?.id
  
  try {
    // Create AI Bus message (Constitutional visibility: tenant)
    const message = await req.payload.create({
      collection: 'messages',
      data: {
        content: {
          type: 'system',
          text: `Product inventory ${change > 0 ? 'increased' : 'decreased'}: ${doc.title}`,
          metadata: {
            event: 'product_inventory_change',
            productId: doc.id,
            productTitle: doc.title,
            previousInventory,
            currentInventory,
            change,
            sku: doc.sku,
            lowStockThreshold: doc.lowStockThreshold || 10,
            isLowStock: currentInventory <= (doc.lowStockThreshold || 10),
            timestamp: new Date().toISOString()
          }
        },
        messageType: 'system',
        visibility: 'tenant', // Constitutional default (Article IV.2)
        priority: currentInventory === 0 ? 'urgent' : 
                  currentInventory <= (doc.lowStockThreshold || 10) ? 'high' : 'normal',
        space: doc.space, // Associate with product's space
        tenant: tenantId,
        sender: req.user?.id || '1', // System user
        // Constitutional basis for this message
        constitutionalNote: operation === 'create' 
          ? 'New product added to inventory - observable via AI Bus per Article IV.4'
          : 'Inventory change detected - Angels may monitor and respond per distributed intelligence pattern'
      }
    })
    
    console.log(`[Constitutional Hook] Product inventory change message created: ${message.id}`)
    console.log(`[Constitutional Hook] Product: ${doc.title}, Change: ${change}, Visibility: tenant`)
    
    // If critically low stock, also create high-priority alert
    if (currentInventory === 0 || (doc.lowStockThreshold && currentInventory < doc.lowStockThreshold * 0.5)) {
      await req.payload.create({
        collection: 'messages',
        data: {
          content: {
            type: 'system',
            text: `⚠️ CRITICAL: ${doc.title} is ${currentInventory === 0 ? 'out of stock' : 'critically low'}`,
            metadata: {
              event: 'critical_low_stock',
              productId: doc.id,
              productTitle: doc.title,
              currentInventory,
              lowStockThreshold: doc.lowStockThreshold,
              needsReorder: true
            }
          },
          messageType: 'system',
          visibility: 'tenant',
          priority: 'urgent',
          space: doc.space,
          tenant: tenantId,
          sender: req.user?.id || '1',
          constitutionalNote: 'Critical inventory alert - Angels should prioritize response'
        }
      })
    }
    
  } catch (error) {
    console.error('[Constitutional Hook] Failed to create AI Bus message:', error)
    // Non-blocking: hook failure shouldn't block product updates
  }
}

/**
 * Before product changes, validate low stock threshold
 */
export const beforeProductChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
}) => {
  // Set default low stock threshold if not specified
  if (operation === 'create' && !data.lowStockThreshold) {
    data.lowStockThreshold = 10 // Reasonable default
  }
  
  // Ensure inventory is non-negative
  if (data.inventory !== undefined && data.inventory < 0) {
    throw new Error('Inventory cannot be negative (Constitutional Article I.4 - Non-Harm: clear error messages)')
  }
  
  return data
}
