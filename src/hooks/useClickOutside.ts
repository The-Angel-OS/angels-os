import { useEffect, type RefObject } from 'react'

/**
 * Dismisses a dropdown/popover when clicking outside or pressing Escape.
 * Combines click-outside + escape-key handling in one elegant hook.
 *
 * @param ref - Ref to the container element
 * @param onClose - Callback to close the dropdown
 * @param isOpen - Whether the dropdown is currently open (skips listeners when closed)
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null)
 * const [open, setOpen] = useState(false)
 * useClickOutside(ref, () => setOpen(false), open)
 * ```
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  isOpen = true,
): void {
  useEffect(() => {
    if (!isOpen) return

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    // Use mousedown (not click) for immediate feel
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [ref, onClose, isOpen])
}
