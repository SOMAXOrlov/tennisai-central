// ============================================================================
// An authenticated image as an object URL.
//
// Photos are never plain file URLs here — every read goes through the API
// behind its authorization check (profile photos: PlayerAvatar.usePlayerPhoto;
// equipment photos: components/equipment/EquipmentPhoto). This is the shared
// mechanics: fetch the blob, hand back an object URL, revoke it when the key
// changes or the component goes away. `key` names WHAT is shown (id plus
// version) so a replaced photo refetches and an unchanged one does not.
// ============================================================================
import { useEffect, useRef, useState } from "react";

export function useBlobUrl(load: (() => Promise<Blob | null>) | null, key: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const loader = loadRef.current;
    if (!key || !loader) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let created: string | null = null;

    void loader()
      .then((blob) => {
        if (cancelled || !blob || blob.size === 0) return;
        if (typeof URL.createObjectURL !== "function") return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        // An unreachable API is not worth a message on a thumbnail.
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      setUrl(null);
      if (created && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(created);
    };
  }, [key]);

  return url;
}
