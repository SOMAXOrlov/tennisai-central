import { useEffect, useState } from "react";
import { isOffline } from "@/lib/errors";

/**
 * `true` while the browser believes it has a network, `false` while it is
 * sure it does not. Follows the `online` / `offline` window events, so an
 * error state shown during a tunnel drops its "you're offline" line the
 * moment the signal comes back.
 *
 * `navigator.onLine` is a coarse signal — "true" only means "not definitely
 * offline" — which is exactly the honesty this is used for: the app never
 * claims you are connected, only tells you when you certainly are not.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => !isOffline());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
