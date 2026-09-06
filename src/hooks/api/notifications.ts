// Feature-scoped hooks for the full notification-preferences + web-push
// surface. Kept out of the shared `@/hooks/api/queries.ts` per the notify
// agent's file ownership — those hooks own the legacy category-only prefs.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/feedback";
import { notificationPrefsApi, type NotificationPreferencesFull, type PushSubscriptionInput } from "@/api/endpoints/notificationPrefs";

const notificationPreferencesFullKey = ["notificationPreferencesFull"] as const;
const pushPublicKeyKey = ["pushPublicKey"] as const;

export function useNotificationPreferencesFull() {
  return useQuery({
    queryKey: notificationPreferencesFullKey,
    queryFn: async () => (await notificationPrefsApi.getPreferences()).data,
  });
}

/** Shared by every in-flight save, so a burst of toggles can be counted (see onSuccess). */
const updatePreferencesMutationKey = ["updateNotificationPreferencesFull"] as const;

// Optimistic: each switch is one boolean on a record the card already holds,
// so it flips as it is tapped and is put back (with a toast) if the save fails.
// The card says "Changes save automatically" — no success toast.
export function useUpdateNotificationPreferencesFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: updatePreferencesMutationKey,
    mutationFn: (patch: Partial<NotificationPreferencesFull>) => notificationPrefsApi.updatePreferences(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: notificationPreferencesFullKey });
      const previous = qc.getQueryData<NotificationPreferencesFull>(notificationPreferencesFullKey);
      qc.setQueryData<NotificationPreferencesFull>(notificationPreferencesFullKey, (old) => (old ? { ...old, ...patch } : old));
      return { previous };
    },
    onSuccess: (res) => {
      // The server's record is the truth — but only once nothing else is in
      // flight, or an early response would flick a later, still-saving switch
      // back until its own response lands.
      if (qc.isMutating({ mutationKey: updatePreferencesMutationKey }) === 1) {
        qc.setQueryData(notificationPreferencesFullKey, res.data);
      }
    },
    onError: (e: unknown, _patch, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(notificationPreferencesFullKey, ctx.previous);
      toastError("toast.notification.preferenceFailed", e);
    },
  });
}

/** Server's VAPID public key, or null when push isn't configured. Static for
 *  the session — no need to refetch once we have (or confirm the absence of) it. */
export function usePushPublicKey() {
  return useQuery({
    queryKey: pushPublicKeyKey,
    queryFn: async () => (await notificationPrefsApi.getPushPublicKey()).data,
    staleTime: Infinity,
  });
}

export function useSubscribePush() {
  return useMutation({
    mutationFn: (sub: PushSubscriptionInput) => notificationPrefsApi.subscribePush(sub),
  });
}

export function useUnsubscribePush() {
  return useMutation({
    mutationFn: (endpoint: string) => notificationPrefsApi.unsubscribePush(endpoint),
  });
}
