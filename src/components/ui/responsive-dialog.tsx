// ============================================================
// A dialog on desktop, a bottom sheet on a phone — one API, the SAME names as
// `ui/dialog`, so a form switches surfaces by changing one import line and
// nothing else. Desktop (≥ md) renders the Radix Dialog exactly as before;
// below md it renders the vaul Drawer that QuickActions already uses, with the
// footer pinned above the safe area so the primary button stays under the
// thumb however long the form gets.
//
// The seam is `useIsMobile()` — the app's one breakpoint (768px), the same
// number Tailwind's `md:` uses, so CSS and JS never disagree about which
// surface is on screen. Tests run with a matchMedia mock that reports
// `matches: false`, so every existing page spec keeps exercising the dialog.
// ============================================================

import * as React from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Dialog as DesktopDialog,
  DialogClose as DesktopDialogClose,
  DialogContent as DesktopDialogContent,
  DialogDescription as DesktopDialogDescription,
  DialogFooter as DesktopDialogFooter,
  DialogHeader as DesktopDialogHeader,
  DialogTitle as DesktopDialogTitle,
  DialogTrigger as DesktopDialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/** True inside a root that decided on the sheet. Children read it, never the media query again. */
const SheetModeContext = React.createContext(false);

/** Which surface is live. Module-private: consumers switch imports, not branches. */
function useIsSheet(): boolean {
  return React.useContext(SheetModeContext);
}

type DialogProps = React.ComponentProps<typeof DesktopDialog>;

const Dialog = ({ children, ...props }: DialogProps) => {
  const sheet = useIsMobile();
  return (
    <SheetModeContext.Provider value={sheet}>
      {sheet ? (
        // `shouldScaleBackground={false}`: the page behind is the app shell,
        // and scaling it fights the fixed header and the ambient court.
        <Drawer shouldScaleBackground={false} {...props}>
          {children}
        </Drawer>
      ) : (
        <DesktopDialog {...props}>{children}</DesktopDialog>
      )}
    </SheetModeContext.Provider>
  );
};
Dialog.displayName = "ResponsiveDialog";

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DesktopDialogTrigger>,
  React.ComponentPropsWithoutRef<typeof DesktopDialogTrigger>
>((props, ref) => (useIsSheet() ? <DrawerTrigger ref={ref} {...props} /> : <DesktopDialogTrigger ref={ref} {...props} />));
DialogTrigger.displayName = "ResponsiveDialogTrigger";

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DesktopDialogClose>,
  React.ComponentPropsWithoutRef<typeof DesktopDialogClose>
>((props, ref) => (useIsSheet() ? <DrawerClose ref={ref} {...props} /> : <DesktopDialogClose ref={ref} {...props} />));
DialogClose.displayName = "ResponsiveDialogClose";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DesktopDialogContent>,
  React.ComponentPropsWithoutRef<typeof DesktopDialogContent>
>(({ className, children, ...props }, ref) => {
  const { t } = useT();
  if (!useIsSheet()) {
    return (
      <DesktopDialogContent ref={ref} className={className} {...props}>
        {children}
      </DesktopDialogContent>
    );
  }
  return (
    // The consumer's className is kept (its `sm:max-w-*` is inert on a
    // phone). `px-4 pb-4` gives the form the page gutter; the sticky footer
    // below cancels that bottom pad so it can sit flush on the sheet edge.
    <DrawerContent ref={ref} className={cn("gap-4 px-4 pb-4", className)} {...props}>
      {children}
      {/* Same close affordance the dialog has — the handle invites a swipe,
          but a tap target is the thing a screen-reader or keyboard user on a
          phone can actually find. */}
      <DrawerClose className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-opacity touch-manipulation hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">{t("mobile.sheet.close")}</span>
      </DrawerClose>
    </DrawerContent>
  );
});
DialogContent.displayName = "ResponsiveDialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
  useIsSheet() ? (
    // Left-aligned and clear of the close button: a centred title under a
    // drag handle reads as a system alert, not the form it introduces.
    <div className={cn("flex flex-col space-y-1.5 pr-10 pt-2 text-left", className)} {...props} />
  ) : (
    <DesktopDialogHeader className={className} {...props} />
  );
DialogHeader.displayName = "ResponsiveDialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
  useIsSheet() ? (
    // `sticky bottom-0` pins the actions to the sheet's own scrollport; the
    // negative margins undo the content padding so the bar runs edge to edge
    // and sits flush on the bottom; the padding clears the home indicator.
    // Column-reverse keeps the dialog's order (cancel first in markup, primary
    // on top on screen) — the same stacking the dialog already used below sm.
    <div
      className={cn(
        "sticky bottom-0 -mx-4 -mb-4 mt-2 flex flex-col-reverse gap-2 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3",
        className,
      )}
      {...props}
    />
  ) : (
    <DesktopDialogFooter className={className} {...props} />
  );
DialogFooter.displayName = "ResponsiveDialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DesktopDialogTitle>,
  React.ComponentPropsWithoutRef<typeof DesktopDialogTitle>
>((props, ref) => (useIsSheet() ? <DrawerTitle ref={ref} {...props} /> : <DesktopDialogTitle ref={ref} {...props} />));
DialogTitle.displayName = "ResponsiveDialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DesktopDialogDescription>,
  React.ComponentPropsWithoutRef<typeof DesktopDialogDescription>
>((props, ref) =>
  useIsSheet() ? <DrawerDescription ref={ref} {...props} /> : <DesktopDialogDescription ref={ref} {...props} />,
);
DialogDescription.displayName = "ResponsiveDialogDescription";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
