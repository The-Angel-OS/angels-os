'use client'

/**
 * Translucent overlay backdrop for modals, panels, and dropdowns.
 * Renders nothing when closed — zero DOM overhead.
 *
 * @example
 * ```tsx
 * <Backdrop isOpen={isPanelOpen} onClick={() => setOpen(false)} />
 * ```
 */
export function Backdrop({
  isOpen,
  onClick,
  zIndex = 'z-40',
  opacity = 'bg-black/20',
}: {
  isOpen: boolean
  onClick: () => void
  zIndex?: string
  opacity?: string
}) {
  if (!isOpen) return null
  return (
    <div
      className={`fixed inset-0 ${zIndex} ${opacity} transition-opacity cursor-pointer`}
      onClick={onClick}
      aria-hidden="true"
    />
  )
}
