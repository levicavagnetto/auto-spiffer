import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const alertVariants = cva('relative w-full rounded-lg p-3 text-sm', {
  variants: {
    variant: {
      default: 'border border-border bg-card text-foreground',
      muted: 'bg-muted text-foreground',
      warning: 'bg-warning text-warning-foreground',
      'warning-subtle': 'bg-warning/30 text-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
      'destructive-subtle': 'bg-destructive/10 text-foreground'
    }
  },
  defaultVariants: { variant: 'default' }
})

/** Message box. Pass `role={undefined}` for a box that is not an announcement. */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants>): React.JSX.Element {
  return (
    <div
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="alert-title"
      className={cn('font-semibold', className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="alert-description"
      className={cn('mt-1', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
