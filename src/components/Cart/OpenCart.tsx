import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'
import React from 'react'

import { cn } from '@/utilities/cn'

export function OpenCartButton({
  className,
  quantity,
  ...rest
}: {
  className?: string
  quantity?: number
}) {
  return (
    <Button
      variant="nav"
      size="clear"
      aria-label={quantity ? `Open cart, ${quantity} item${quantity === 1 ? '' : 's'}` : 'Open cart'}
      // The `nav` variant is built for TEXT links: pt-2/pb-6, so the label sits
      // high and the underline has room. An icon inherits that as a 48px-tall box
      // with the glyph jammed against the top — and a badge pinned to the glyph's
      // corner then rides the header's edge and gets clipped. An icon button wants
      // a square, centered box of its own.
      className={cn(
        'navLink relative hover:cursor-pointer h-9 w-9 self-center items-center justify-center p-0 pt-0 pb-0',
        className,
      )}
      {...rest}
    >
      <ShoppingCart className="size-5" />

      {quantity ? (
        // -right-1/-top-1, not -2: at -2 the badge sits far enough outside the
        // button that the header's top edge clipped it in half. Tucked closer,
        // it stays inside the row at every viewport.
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {quantity}
        </span>
      ) : null}
    </Button>
  )
}
