import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/50 bg-primary/20 text-primary shadow-sm hover:bg-primary/30",
        secondary:
          "border-ctp-mauve/15 bg-ctp-mauve/8 text-foreground hover:bg-ctp-mauve/12",
        destructive:
          "border-destructive/50 bg-destructive/20 text-destructive shadow-sm hover:bg-destructive/30",
        outline: "border-accent text-foreground hover:bg-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
