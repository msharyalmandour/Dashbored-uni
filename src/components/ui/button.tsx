import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Three tiers, and the tiers mean something.
 *
 * Before this, `default` was a flat block of the accent that grew a glow on
 * hover, `secondary` was a flat grey block, and `outline` was a hairline
 * rectangle — three different ideas of what a button is made of, none of them
 * the material the rest of the product is built from. On a screen with a
 * primary action, a filter and a "show more", all three shouted at the same
 * volume.
 *
 *   **default** — the domed accent. Lit along the top edge, shaded at the
 *   bottom, with a warm cast shadow: an object with a near face, and the most
 *   expensive material in the product. One per screen.
 *
 *   **secondary** — the same dome in the neutral. Present, pressable, and
 *   quiet enough that it never competes with the one above it.
 *
 *   **ghost / link** — text and nothing else, until you are over it. The
 *   tertiary tier, and the right answer far more often than it gets used.
 *
 * `outline` and `destructive` stay because they are load-bearing elsewhere —
 * a hairline is still right for a control sitting on top of a photograph, and
 * a delete has to look like one.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "glossy font-semibold hover:brightness-[1.06]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
        outline: "border border-border bg-transparent hover:border-primary/40 hover:bg-muted",
        secondary: "glossy-quiet hover:brightness-110",
        ghost: "hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 [&_svg]:size-4",
        sm: "h-8 rounded-md px-3 text-xs [&_svg]:size-3.5",
        lg: "h-11 rounded-md px-6 text-base [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
