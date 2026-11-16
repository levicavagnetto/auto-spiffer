import * as React from 'react'
import { cn } from '../../lib/utils'

function Card({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-xl border border-border bg-card text-foreground',
        className
      )}
      {...props}
    />
  )
}

function CardTitle({
  className,
  ...props
}: React.ComponentProps<'h2'>): React.JSX.Element {
  return (
    <h2
      data-slot="card-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<'p'>): React.JSX.Element {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Card, CardTitle, CardDescription }
