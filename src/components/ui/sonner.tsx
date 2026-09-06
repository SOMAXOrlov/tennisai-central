import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { subscribeErrorAnnouncements } from "@/lib/feedback";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * The assertive half of the toast system.
 *
 * Sonner announces every toast politely. This one persistent, visually hidden
 * `role="alert"` element receives only error text (published by `toastError`
 * and the destructive path of `@/hooks/use-toast`), so a failure interrupts a
 * screen reader while a success waits its turn. A live region announces on
 * content *change*, so the text is keyed by a sequence number: the same error
 * twice is two announcements, not one.
 */
export function ErrorAnnouncer() {
  const [announcement, setAnnouncement] = useState<{ text: string; seq: number } | null>(null);

  useEffect(
    () =>
      subscribeErrorAnnouncements((text) => {
        setAnnouncement((prev) => ({ text, seq: (prev?.seq ?? 0) + 1 }));
      }),
    [],
  );

  return (
    <div role="alert" aria-atomic="true" className="sr-only" data-testid="error-announcer">
      {announcement && <span key={announcement.seq}>{announcement.text}</span>}
    </div>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
      <ErrorAnnouncer />
    </>
  );
};

export { Toaster, toast };
