import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[#8B5CF6]/50 bg-[#8B5CF6]/20 text-[#8B5CF6] shadow-sm hover:bg-[#8B5CF6]/30",
        secondary:
          "border-[#313244] bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]",
        destructive:
          "border-[#f38ba8]/50 bg-[#f38ba8]/20 text-[#f38ba8] shadow-sm hover:bg-[#f38ba8]/30",
        outline: "border-[#45475a] text-[#cdd6f4] hover:bg-[#313244]",
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
