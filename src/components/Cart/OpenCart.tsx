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
      className={cn('navLink relative hover:cursor-pointer', className)}
      {...rest}
    >
      <ShoppingCart className="h-5 w-5" />

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
