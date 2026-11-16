import * as React from 'react'
import { cn } from '../../lib/utils'

function Label({
  className,
  ...props
}: React.ComponentProps<'label'>): React.JSX.Element {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Label }
