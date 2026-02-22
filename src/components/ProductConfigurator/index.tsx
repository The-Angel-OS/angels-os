'use client'

import React, { useState, useCallback } from 'react'
import { ShoppingCart, MessageSquare, Eye } from 'lucide-react'

interface ConfiguratorOptions {
  customText?: boolean
  maxTextLength?: number
  colors?: string[]
  sizes?: string[]
  finishes?: string[]
  containers?: string[]
}

interface ProductConfiguratorProps {
  productId: number
  productTitle: string
  priceInUSD: number
  options: ConfiguratorOptions
  onAddToCart?: (productId: number, customizations: Record<string, string>) => void
  onPreviewWithLeo?: (productId: number, customizations: Record<string, string>) => void
}

/**
 * ProductConfigurator — Interactive product customization component.
 *
 * Reads `configuratorOptions` JSON from the product and renders:
 * - Text input for custom text
 * - Color swatches
 * - Size/finish/container selectors
 * - Live preview area
 * - "Preview with LEO" button → sends config to chat
 * - "Add to Cart" button with customization data
 */
export function ProductConfigurator({
  productId,
  productTitle,
  priceInUSD,
  options,
  onAddToCart,
  onPreviewWithLeo,
}: ProductConfiguratorProps) {
  const [customizations, setCustomizations] = useState<Record<string, string>>({})

  const updateCustomization = useCallback((key: string, value: string) => {
    setCustomizations((prev) => ({ ...prev, [key]: value }))
  }, [])

  const hasCustomizations = Object.keys(customizations).some((k) => customizations[k])

  // Color name to CSS color mapping (for swatch display)
  const colorMap: Record<string, string> = {
    'Sunset Gold': '#C4973B',
    'Ocean Teal': '#1A7A6D',
    'Flamingo Pink': '#FF6B9D',
    'Palm Green': '#2D5016',
    'Heather Gold': '#B8960F',
    'Vintage Teal': '#1A7A6D',
    'Charcoal': '#36454F',
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{productTitle}</h3>
        <p className="text-sm text-muted-foreground">
          ${(priceInUSD / 100).toFixed(2)} &middot; Customize below
        </p>
      </div>

      {/* Custom Text */}
      {options.customText && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Custom Text</label>
          <input
            type="text"
            value={customizations.customText || ''}
            onChange={(e) => updateCustomization('customText', e.target.value)}
            maxLength={options.maxTextLength || 50}
            placeholder="Enter your custom text..."
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          {options.maxTextLength && (
            <p className="mt-1 text-xs text-muted-foreground">
              {(customizations.customText || '').length}/{options.maxTextLength} characters
            </p>
          )}
        </div>
      )}

      {/* Color Swatches */}
      {options.colors && options.colors.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Color{customizations.color ? `: ${customizations.color}` : ''}
          </label>
          <div className="flex flex-wrap gap-2">
            {options.colors.map((color) => {
              const bgColor = colorMap[color] || '#888'
              const isSelected = customizations.color === color
              return (
                <button
                  key={color}
                  onClick={() => updateCustomization('color', color)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/50'
                  }`}
                  title={color}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-border/50"
                    style={{ backgroundColor: bgColor }}
                  />
                  {color}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Size Selector */}
      {options.sizes && options.sizes.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Size</label>
          <div className="flex flex-wrap gap-2">
            {options.sizes.map((size) => (
              <button
                key={size}
                onClick={() => updateCustomization('size', size)}
                className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                  customizations.size === size
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Finish Selector */}
      {options.finishes && options.finishes.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Finish</label>
          <div className="flex flex-wrap gap-2">
            {options.finishes.map((finish) => (
              <button
                key={finish}
                onClick={() => updateCustomization('finish', finish)}
                className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                  customizations.finish === finish
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {finish}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Container Selector */}
      {options.containers && options.containers.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Container</label>
          <div className="flex flex-wrap gap-2">
            {options.containers.map((container) => (
              <button
                key={container}
                onClick={() => updateCustomization('container', container)}
                className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                  customizations.container === container
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {container}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview Area */}
      {hasCustomizations && (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
            <Eye size={14} />
            Preview
          </div>
          <div className="space-y-1 text-sm">
            {Object.entries(customizations).map(([key, value]) =>
              value ? (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium">{value}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {onPreviewWithLeo && (
          <button
            onClick={() => onPreviewWithLeo(productId, customizations)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MessageSquare size={16} />
            Preview with LEO
          </button>
        )}
        {onAddToCart && (
          <button
            onClick={() => onAddToCart(productId, customizations)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart size={16} />
            Add to Cart
          </button>
        )}
      </div>
    </div>
  )
}
