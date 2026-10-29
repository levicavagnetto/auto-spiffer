import { useEffect } from 'react'

export function ErrorToast({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}): React.JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 7000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-destructive-foreground/30 bg-destructive p-4 text-sm text-destructive-foreground shadow-lg"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss error"
        className="rounded px-1 text-destructive-foreground/70 hover:text-destructive-foreground"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
