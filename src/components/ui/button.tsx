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
/**
 * RESKIN: the identity's button, in the shared primitive.
 *
 * TWO THINGS CHANGED AND BOTH ARE RULES, not taste.
 *
 * `rounded-md` BECAME A PILL. The brief sets a button's radius to half its
 * height, which is what makes it read as the same family as the chips, the
 * segmented control and the brand's own curve.
 *
 * EVERY SIZE CLEARS 44px. `sm` was 32 and the default was 36 — both below
 * the floor this product set for itself, on a control pressed with a thumb
 * on a bus. `sm` is now a smaller TYPE size inside the same target, which is
 * what "small" should have meant.
 *
 * The primary is the brand gradient with its dark ink, so a Button with no
 * props is the one orange button a screen is allowed.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "font-semibold text-[#1c0900] [background-image:linear-gradient(90deg,#FF7A00,#FFA640)] shadow-[0_12px_30px_rgba(255,122,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-[1.06]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
        outline:
          "border border-[color:var(--glass-border)] bg-[rgba(255,240,225,0.06)] hover:border-[color:var(--o-500)]",
        secondary:
          "border border-[color:var(--glass-border)] bg-[rgba(255,240,225,0.06)] text-[color:var(--cream)] hover:brightness-125",
        ghost: "hover:bg-[rgba(255,240,225,0.08)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-5 py-2 [&_svg]:size-4",
        /* Smaller TYPE, same target. */
        sm: "min-h-11 px-4 text-xs [&_svg]:size-3.5",
        lg: "min-h-12 px-7 text-base [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-4",
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
