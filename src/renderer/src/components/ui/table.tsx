import * as React from 'react'
import { cn } from '../../lib/utils'

function Table({
  className,
  ...props
}: React.ComponentProps<'table'>): React.JSX.Element {
  return (
    <table
      data-slot="table"
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  )
}

function TableHeader({
  className,
  ...props
}: React.ComponentProps<'thead'>): React.JSX.Element {
  return <thead data-slot="table-header" className={className} {...props} />
}

function TableBody({
  className,
  ...props
}: React.ComponentProps<'tbody'>): React.JSX.Element {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableRow({
  className,
  ...props
}: React.ComponentProps<'tr'>): React.JSX.Element {
  return (
    <tr
      data-slot="table-row"
      className={cn('border-b border-border last:border-0', className)}
      {...props}
    />
  )
}

function TableHead({
  className,
  ...props
}: React.ComponentProps<'th'>): React.JSX.Element {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'px-3 py-2 text-left align-middle font-semibold',
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  ...props
}: React.ComponentProps<'td'>): React.JSX.Element {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 py-2 align-middle', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
