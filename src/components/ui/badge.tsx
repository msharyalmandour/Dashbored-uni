import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-[color:var(--glass-border)] text-foreground",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        /* RESKIN: achievement is orange or gold, never green. The brief says
           so by name, and a green tick beside an orange product reads as a
           second, unrelated colour family on the same row. */
        warning: "border-transparent bg-[rgba(255,138,0,0.16)] text-[color:var(--o-300)]",
        success: "border-transparent bg-[rgba(255,179,71,0.16)] text-[color:var(--o-400)]",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
