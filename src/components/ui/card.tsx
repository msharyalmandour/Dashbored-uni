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
/**
 * The three levels, now made of something.
 *
 * They used to be a fill, a hairline border and a flat shadow — so a card was
 * a dark rounded rectangle, and a page of them read as a form rather than a
 * set of objects. Colour was never going to fix that: the problem was that
 * they had no depth to have.
 *
 * `default` and `elevated` are now the panel material — a lit near edge, a far
 * edge in shadow, the material's own thickness at the cut, and a cast shadow
 * with real distance. `quiet` deliberately stays flatter: something has to
 * recede, and if every surface is premium then none of them is.
 *
 * The material is defined once in globals.css, so every card in the app
 * inherits it without twenty pages being edited.
 */
const cardVariants = cva(
  "text-card-foreground transition-[border-color,box-shadow,transform] duration-200",
  {
    variants: {
      variant: {
        default: "panel",
        elevated: "panel",
        /* Supporting information. Flat on purpose — the contrast between this
           and `default` is what makes `default` read as substantial.

           It used to use `surface-secondary`, which is a blue-grey, and next to
           the panels' teal it read as a second, unrelated colour family on the
           same page. Same hue as the panel, just without the bevel, the rim or
           the cast shadow: recessed rather than merely different. */
        quiet:
          "rounded-xl bg-[oklch(21%_0.022_209_/_78%)] shadow-[inset_0_1px_0_oklch(100%_0_0_/_6%),inset_0_0_0_1px_oklch(100%_0_0_/_4%)] backdrop-blur-md",
        /* Reserved for the one or two hero surfaces per screen — see the
           .glass comment in globals.css for why this stays a deliberate, rare
           choice rather than the default look. */
        glass: "glass rounded-[1.5rem]",
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
      className={cn(
        cardVariants({ variant }),
        // A card you can press earns the depth response. One you cannot stays
        // still, so the movement means something when it happens.
        interactive && "panel-3d cursor-pointer hover:-translate-y-0.5",
        className
      )}
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
