import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps): React.JSX.Element {
  return (
    <Sonner
      position="bottom-right"
      offset={20}
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm',
          error:
            '!border-destructive-foreground/30 !bg-destructive !text-destructive-foreground'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
