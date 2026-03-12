import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-accent bg-secondary px-3 py-2 shadow-sm transition-all placeholder:text-ctp-overlay0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary hover:border-ctp-surface2 disabled:cursor-not-allowed disabled:opacity-50 text-base text-ctp-text md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
