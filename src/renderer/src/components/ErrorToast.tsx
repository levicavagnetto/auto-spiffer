import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'

/**
 * Shows `message` as a Sonner error toast while this component is mounted.
 * The toast keeps the `alert` role so screen readers announce it.
 */
export function ErrorToast({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}): null {
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    const id = toast.custom(
      (toastId) => (
        <div
          role="alert"
          className="flex w-[356px] max-w-full items-start gap-3 rounded-lg border border-destructive-foreground/30 bg-destructive p-4 font-sans text-sm text-destructive-foreground shadow-lg"
        >
          <span className="flex-1">{message}</span>
          <Button
            type="button"
            variant="ghost"
            size="inline"
            aria-label="Dismiss error"
            className="rounded px-1 text-destructive-foreground/70 hover:bg-transparent hover:text-destructive-foreground"
            onClick={() => {
              toast.dismiss(toastId)
              dismissRef.current()
            }}
          >
            ×
          </Button>
        </div>
      ),
      { duration: 7000, onAutoClose: () => dismissRef.current() }
    )
    return () => {
      toast.dismiss(id)
    }
  }, [message])

  return null
}
