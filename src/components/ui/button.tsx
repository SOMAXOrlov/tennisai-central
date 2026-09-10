import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // `active:scale` gives every button in the app a physical press. 0.97 over
  // 100ms — enough to feel, too small to look bouncy against a matte brand.
  // transition-[colors,transform], not transition-all, so a button whose label
  // changes ("Save" → "Saving…") doesn't animate its own width.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color,transform] duration-120 ease-snap active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation",
  {
    variants: {
      variant: {
        // Ink fill, not the brand green: green is the app's ONE accent and a
        // page full of green buttons would spend it everywhere. The green
        // shows up as a 2px baseline that slides in on hover — enough to tie
        // the button to the brand, small enough to stay matte.
        // `overflow-hidden` clips the baseline, not the focus ring (outline
        // paints outside the border box).
        default:
          "relative overflow-hidden bg-ink text-ink-foreground hover:bg-ink/85 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-120 after:ease-snap hover:after:scale-x-100 motion-reduce:after:transition-none",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Touch sizing rule: `coarse:min-h-11` (44px), never `coarse:h-11`.
      //
      // min-height beats height in the cascade no matter which rule wins on
      // specificity, so a caller that hard-codes `className="h-8 w-8"` — and
      // dozens across the app do — still gets a 44px finger target on a phone
      // while keeping its 32px look on a mouse. tailwind-merge treats
      // `h-8` and `coarse:min-h-11` as different modifier sets, so neither
      // deduplicates the other away.
      // One scale — 44 / 40 / 32. `sm` used to be 36px, which put it a hair
      // under the 40px default and led pages to hand-roll 32px controls next
      // to it; three visibly distinct steps stop that.
      size: {
        default: "h-10 px-4 py-2 coarse:min-h-11 coarse:min-w-11",
        sm: "h-8 rounded-md px-3 coarse:min-h-11 coarse:min-w-11",
        // Already 44px — nothing to raise.
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 coarse:min-h-11 coarse:min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * In-flight state for a submit: disables the control, announces `aria-busy`
   * and swaps a spinner in ahead of the label. The label itself is the
   * caller's — pass the progressive verb ("Saving…") as children so the width
   * change is deliberate and translated, not something this primitive invents.
   * Ignored with `asChild` (a Slot has no place to mount the spinner).
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>{children}</Comp>;
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 aria-hidden="true" className="animate-spin" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
