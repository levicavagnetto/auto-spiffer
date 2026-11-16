import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '../../lib/utils'

function RadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.Props): React.JSX.Element {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('grid gap-3', className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: RadioPrimitive.Root.Props): React.JSX.Element {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'inline-flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[checked]:border-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2 rounded-full bg-primary"
      />
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
