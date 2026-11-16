import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

const Sheet = SheetPrimitive.Root
const SheetClose = SheetPrimitive.Close

function SheetContent({
  className,
  children,
  closeLabel = 'Close',
  ...props
}: SheetPrimitive.Popup.Props & { closeLabel?: string }): React.JSX.Element {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-40 bg-(--scrim)"
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[440px] max-w-full overflow-y-auto border-l border-border bg-card p-6 text-foreground shadow-xl outline-none',
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-5 right-5 rounded-md p-1 opacity-70 hover:bg-muted hover:opacity-100 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <XIcon className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({
  className,
  ...props
}: SheetPrimitive.Title.Props): React.JSX.Element {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('pr-8 text-lg font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props): React.JSX.Element {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetDescription }
