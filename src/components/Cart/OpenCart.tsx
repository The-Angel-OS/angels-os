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
        <span className="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {quantity}
        </span>
      ) : null}
    </Button>
  )
}
