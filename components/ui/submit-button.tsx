import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ButtonProps = React.ComponentProps<typeof Button>

export function SubmitButton({
  isPending,
  children,
  ...props
}: ButtonProps & { isPending: boolean }) {
  return (
    <Button {...props} type="submit" disabled={isPending}>
      {isPending && <Loader2 className="animate-spin" />}
      <span className={isPending ? 'opacity-60' : undefined}>{children}</span>
    </Button>
  )
}
