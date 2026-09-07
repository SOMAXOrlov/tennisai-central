// ============================================================================
// PlayerAvatar — one person's photo, or their initials.
//
// WHY IT FETCHES INSTEAD OF USING <img src>
// The image endpoint requires a Bearer token and an `<img>` element cannot
// send a header. The alternative — putting the token in the URL — would write
// a session credential into browser history, proxy logs and the Referer of
// whatever the page loads next. So the bytes are fetched with the token,
// turned into an object URL, and the object URL is what the `<img>` sees.
//
// WHY A MISSING PHOTO AND A REFUSED ONE LOOK THE SAME
// They are the same thing to a reader: initials. The API answers 404 for "no
// photo" and 403 for "not yours to see" with identical bodies on purpose, and
// this component keeps that indistinguishable in the UI too — nothing here
// says "this person has a photo you are not allowed to see", because saying so
// would leak the fact the endpoint works hard not to.
// ============================================================================

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { photosApi } from "@/api/endpoints/photos";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Up to two letters from a name, for the fallback. */
export function initialsFrom(firstName?: string | null, lastName?: string | null, fullName?: string): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (first || last) {
    return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
  }
  return (fullName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();
}

/**
 * One in-flight request per person, shared by every avatar showing them.
 *
 * Measured, not assumed: the profile page renders three avatars of the signed-in
 * user (the sidebar, the profile card, the photo card) and each one was issuing
 * its own GET for the same bytes — three requests, and three 404s in the
 * console for anyone without a photo. The promise is cached, not the object URL:
 * each component still mints and revokes its own URL, so there is no reference
 * counting to get wrong.
 *
 * The key includes `version`, so replacing your own photo misses the cache and
 * refetches. For somebody else's avatar there is no version to key on, so their
 * photo is fetched once per page load — a photo they change mid-session appears
 * on the next navigation. Same for a refusal that later becomes an allowance
 * (a coach assignment created while the page is open).
 */
const photoRequests = new Map<string, Promise<Blob | null>>();

/** Enough for any page's worth of avatars; keeps a long session bounded. */
const PHOTO_REQUEST_CACHE_MAX = 50;

function requestPhoto(userId: string, version?: string | number | null): Promise<Blob | null> {
  const key = `${userId}|${version ?? ""}`;
  const existing = photoRequests.get(key);
  if (existing) return existing;

  const pending = photosApi.fetchPhoto(userId).catch(() => {
    // A failure must not be remembered forever: the next mount should retry.
    photoRequests.delete(key);
    return null;
  });

  if (photoRequests.size >= PHOTO_REQUEST_CACHE_MAX) {
    const oldest = photoRequests.keys().next();
    if (!oldest.done) photoRequests.delete(oldest.value);
  }
  photoRequests.set(key, pending);
  return pending;
}

/** Test seam: forget every cached request between specs. */
export function clearPhotoRequestCache(): void {
  photoRequests.clear();
}

/**
 * The photo for one user as an object URL, or null when there is nothing to
 * show — no id, no photo, not permitted, a network failure, or a browser that
 * would not mint the URL.
 *
 * `version` re-runs the fetch: pass the owner's `photoUpdatedAt` so replacing
 * your own photo is visible immediately. The response carries a strong ETag
 * and `Cache-Control: private, must-revalidate`, so an unchanged photo costs a
 * 304 rather than the bytes.
 *
 * `hasPhoto: false` skips the request entirely. Only your own client knows this
 * — `photoId` is on your own user row and on nobody else's — and it is worth
 * using: it saves a request and a console 404 on every page you load without a
 * photo. `undefined` means "not known", which is the honest state for everybody
 * else, and then the only way to find out is to ask.
 */
export function usePlayerPhoto(
  userId?: string | null,
  version?: string | number | null,
  hasPhoto?: boolean,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || hasPhoto === false) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    void requestPhoto(userId, version)
      .then((blob) => {
        if (cancelled || !blob || blob.size === 0) return;
        if (typeof URL.createObjectURL !== "function") return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        // An unreachable API is not worth a message on an avatar. Initials.
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      setUrl(null);
      if (created && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(created);
    };
  }, [userId, version, hasPhoto]);

  return url;
}

export interface PlayerAvatarProps {
  /** Whose photo to ask for. Omitted or empty → initials, with no request. */
  userId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Used for the initials and the alt text when the name is not split. */
  name?: string;
  /** Changing this re-fetches — pass `photoUpdatedAt` for your own avatar. */
  version?: string | number | null;
  /**
   * `false` skips the request. Pass `Boolean(user.photoId)` for YOUR OWN
   * avatar, where the answer is already known; leave it undefined for anybody
   * else, where it is not, and the endpoint decides.
   */
  hasPhoto?: boolean;
  /** Sizing and shape live with the caller; this only adds to them. */
  className?: string;
  /** Extra classes for the initials circle (callers tint it per surface). */
  fallbackClassName?: string;
}

/**
 * The photo when the viewer may see it, initials otherwise. Falls back to
 * initials on a failed load too, the way `SurfaceImage` does with a broken
 * asset: `AvatarImage` only replaces the fallback once the bytes have decoded,
 * and `onError` drops a URL that turned out to be undecodable.
 */
export function PlayerAvatar({
  userId,
  firstName,
  lastName,
  name,
  version,
  hasPhoto,
  className,
  fallbackClassName,
}: PlayerAvatarProps) {
  const { t } = useT();
  const photoUrl = usePlayerPhoto(userId, version, hasPhoto);
  const [failed, setFailed] = useState(false);

  const displayName = name ?? [firstName, lastName].filter(Boolean).join(" ");
  const initials = initialsFrom(firstName, lastName, name);

  useEffect(() => setFailed(false), [photoUrl]);

  return (
    // `key` is load-bearing, not decoration. Radix's Avatar tracks the image's
    // loading status on its ROOT and shows the fallback only while that status
    // is not "loaded" — and nothing resets it when the `AvatarImage` unmounts.
    // So removing your photo left the root still believing an image was loaded,
    // and the circle rendered EMPTY instead of falling back to initials. Found
    // in a browser, after a real remove. Keying the root on whether there is a
    // photo remounts it on that transition, which is the only thing that clears
    // the status.
    <Avatar key={photoUrl ? "photo" : "initials"} className={cn("h-10 w-10", className)}>
      {photoUrl && !failed && (
        <AvatarImage
          src={photoUrl}
          alt={t("photo.avatarAlt", { name: displayName })}
          onError={() => setFailed(true)}
          className="object-cover"
        />
      )}
      <AvatarFallback
        className={cn("bg-primary/10 text-sm font-bold text-primary", fallbackClassName)}
        // Decorative: the name is always beside the avatar on every surface
        // that renders one, so reading the initials out again is noise.
        aria-hidden="true"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
