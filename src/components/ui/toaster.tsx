/**
 * Legacy mount point of the Radix toast list. Toasts are rendered by sonner
 * (`<Toaster />` from `@/components/ui/sonner`, mounted in App.tsx) and
 * `@/hooks/use-toast` forwards the old `toast({ title })` calls there, so this
 * renders nothing. Kept so an import of it does not break; nothing mounts it.
 */
export function Toaster() {
  return null;
}
