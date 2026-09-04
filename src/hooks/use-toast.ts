// ============================================================
// `useToast` / `toast({ title, description, variant })` — compatibility
// adapter over sonner.
//
// The app used to mount TWO toast systems: this file's Radix/shadcn reducer
// (rendered by ui/toaster.tsx) and sonner (ui/sonner.tsx). Only two call sites
// still used the Radix shape, and its reducer had a `TOAST_REMOVE_DELAY` of
// 1,000,000ms — a dismissed toast was never actually removed. Everything now
// goes through sonner; this module keeps the old call signature working so
// those call sites (and the tests that spy on this module) need no change.
// ============================================================

import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { ERROR_TOAST_DURATION_MS } from "@/lib/feedback";

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** `destructive` → an error toast; anything else → a success toast. */
  variant?: "default" | "destructive" | null;
  /** Kept for signature compatibility; forwarded to sonner as-is. */
  action?: React.ReactNode;
  duration?: number;
}

export interface ToastHandle {
  id: string | number;
  dismiss: () => void;
  update: (next: ToastOptions) => void;
}

/** Sonner puts the title first and everything else in an options bag. */
function toSonnerArgs({ title, description, action, duration, variant }: ToastOptions) {
  const isError = variant === "destructive";
  return {
    message: title ?? description ?? "",
    options: {
      // If there is no title the description already IS the message.
      description: title ? description : undefined,
      action,
      duration: duration ?? (isError ? ERROR_TOAST_DURATION_MS : undefined),
    },
    isError,
  };
}

function toast(options: ToastOptions): ToastHandle {
  const { message, options: sonnerOptions, isError } = toSonnerArgs(options);
  const id = isError ? sonnerToast.error(message, sonnerOptions) : sonnerToast.success(message, sonnerOptions);
  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next) => {
      const merged = toSonnerArgs({ ...options, ...next });
      const show = merged.isError ? sonnerToast.error : sonnerToast.success;
      show(merged.message, { ...merged.options, id });
    },
  };
}

/**
 * Hook-shaped access for components written against the shadcn API. `toasts`
 * is always empty: sonner owns the list and renders it itself.
 */
function useToast() {
  return {
    toasts: [] as never[],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
