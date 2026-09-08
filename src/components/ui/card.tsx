import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Three surface levels, not five — enough to express "this card matters
 * more than that one" without turning every screen into a visual puzzle.
 * `elevated` is for the one or two things per view that should read as
 * dominant (hero-adjacent, primary focus); `quiet` recedes for secondary/
 * supporting information; `default` is the workhorse for everything else.
 */
const cardVariants = cva(
  "rounded-xl border text-card-foreground transition-[border-color,box-shadow,transform] duration-200",
  {
    variants: {
      variant: {
        default: "border-border bg-card shadow-sm",
        elevated: "border-border-subtle bg-surface-elevated shadow-elevated",
        quiet: "border-border-subtle bg-surface-secondary shadow-none",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  /** Marks a card as clickable/actionable — adds the shared hover-lift affordance. */
  interactive?: boolean;
}

function Card({ className, variant, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant }), interactive && "hover-elevate cursor-pointer", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-display text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
