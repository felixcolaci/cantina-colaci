import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, onKeyDown, ...props }: React.ComponentProps<"input">) {
  // Mobile virtual keyboards (esp. Android number pads) map their action key
  // ("Weiter"/"Fertig"/a checkmark) to a plain Enter keydown. Every one of
  // these forms has exactly one submit button, so without this guard that
  // Enter implicitly submits the *whole* form the moment it fires -- even
  // while the user is only mid-edit on this one field, with later fields
  // (e.g. a photo picker) not yet touched. Callers that want Enter to do
  // something can still call preventDefault() in their own onKeyDown.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e)
    if (e.key === 'Enter' && !e.defaultPrevented) e.preventDefault()
  }

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      onKeyDown={handleKeyDown}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
