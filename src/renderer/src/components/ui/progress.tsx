import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import { cn } from '../../lib/utils'

function Progress({
  className,
  children,
  ...props
}: ProgressPrimitive.Root.Props): React.JSX.Element {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('w-full', className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({
  className,
  ...props
}: ProgressPrimitive.Track.Props): React.JSX.Element {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted',
        className
      )}
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props): React.JSX.Element {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        'h-full rounded-full bg-primary transition-[width] duration-300',
        className
      )}
      {...props}
    />
  )
}

export { Progress, ProgressTrack, ProgressIndicator }
