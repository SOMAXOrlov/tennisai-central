// ============================================================================
// PlayerAvatar — the decision layer.
//
// What is asserted is the DECISION, not the pixels: which request it makes,
// and whether it ends up on initials. Radix's AvatarImage only replaces the
// fallback once the browser has decoded the bytes, and jsdom never decodes
// anything, so "the photo is visible" is not a claim this environment can
// support — pinning it would be pinning a lie. The visible result is confirmed
// in a real browser instead (see the branch report).
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const fetchPhoto = vi.fn<(userId: string) => Promise<Blob | null>>();

vi.mock("@/api/endpoints/photos", () => ({
  photosApi: { fetchPhoto: (id: string) => fetchPhoto(id) },
}));

import { PlayerAvatar, clearPhotoRequestCache, initialsFrom } from "@/components/PlayerAvatar";

const createObjectURL = vi.fn(() => "blob:photo-1");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  fetchPhoto.mockReset();
  clearPhotoRequestCache();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  // jsdom has neither.
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A blob the component will accept (non-empty). */
function photoBlob(): Blob {
  return new Blob(["webp-bytes"], { type: "image/webp" });
}

describe("initialsFrom", () => {
  it("takes the first letter of each name", () => {
    expect(initialsFrom("Alex", "Rivera")).toBe("AR");
  });

  it("falls back to a single full name", () => {
    expect(initialsFrom(undefined, undefined, "Jordan Smith")).toBe("JS");
    expect(initialsFrom(null, null, "Morgan")).toBe("M");
  });

  it("takes at most two letters, ignoring the rest", () => {
    expect(initialsFrom(undefined, undefined, "Maria del Carmen Ruiz")).toBe("MD");
  });

  it("is empty rather than wrong when there is no name", () => {
    expect(initialsFrom()).toBe("");
    expect(initialsFrom("", "", "")).toBe("");
  });
});

describe("PlayerAvatar", () => {
  it("shows initials and asks for nothing when there is no user id", () => {
    render(<PlayerAvatar firstName="Alex" lastName="Rivera" />);
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(fetchPhoto).not.toHaveBeenCalled();
  });

  it("asks the API for that user's photo", async () => {
    fetchPhoto.mockResolvedValue(photoBlob());
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledWith("p1"));
  });

  it("shows initials when the viewer may not see the photo", async () => {
    // A refusal reaches the component as null — the same value "no photo"
    // produces, which is the point: the UI cannot tell them apart either.
    fetchPhoto.mockResolvedValue(null);
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalled());
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("shows initials when the request fails outright", async () => {
    fetchPhoto.mockRejectedValue(new Error("offline"));
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalled());
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("shows initials for an empty response body rather than a blank circle", async () => {
    fetchPhoto.mockResolvedValue(new Blob([], { type: "image/webp" }));
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalled());
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("turns the bytes into an object URL rather than an addressable one", async () => {
    fetchPhoto.mockResolvedValue(photoBlob());
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    // The blob URL is per-document and unguessable; nothing in the DOM names
    // the stored file or the API path.
    expect(document.body.innerHTML).not.toContain("/photo");
  });

  it("releases the object URL when it unmounts", async () => {
    fetchPhoto.mockResolvedValue(photoBlob());
    const view = render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:photo-1");
  });

  it("re-fetches when the version changes, so a replaced photo appears", async () => {
    fetchPhoto.mockResolvedValue(photoBlob());
    const view = render(<PlayerAvatar userId="p1" firstName="A" lastName="R" version="2026-09-01" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(1));

    view.rerender(<PlayerAvatar userId="p1" firstName="A" lastName="R" version="2026-09-02" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(2));
  });

  it("does not re-fetch on an unrelated re-render", async () => {
    fetchPhoto.mockResolvedValue(photoBlob());
    const view = render(<PlayerAvatar userId="p1" firstName="A" lastName="R" version="2026-09-01" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(1));

    view.rerender(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" version="2026-09-01" />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchPhoto).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing when the caller already knows there is no photo", async () => {
    // Your own client knows: `photoId` is on your own user row. Asking anyway
    // costs a request and a 404 in the console on every page load.
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" hasPhoto={false} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchPhoto).not.toHaveBeenCalled();
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("still asks when nobody has said either way", async () => {
    // The honest state for everybody else's avatar: only the endpoint knows.
    fetchPhoto.mockResolvedValue(photoBlob());
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledWith("p1"));
  });

  it("makes ONE request for several avatars of the same person", async () => {
    // The profile page renders three of these for the signed-in user: the
    // sidebar, the profile card and the photo card. Three requests for the
    // same bytes is what this replaced.
    fetchPhoto.mockResolvedValue(photoBlob());
    render(
      <>
        <PlayerAvatar userId="p1" firstName="A" lastName="R" version="v1" />
        <PlayerAvatar userId="p1" firstName="A" lastName="R" version="v1" />
        <PlayerAvatar userId="p1" firstName="A" lastName="R" version="v1" />
      </>,
    );
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(fetchPhoto).toHaveBeenCalledTimes(1);
  });

  it("still asks separately for different people", async () => {
    fetchPhoto.mockResolvedValue(photoBlob());
    render(
      <>
        <PlayerAvatar userId="p1" firstName="A" lastName="R" />
        <PlayerAvatar userId="p2" firstName="B" lastName="S" />
      </>,
    );
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(2));
    expect(fetchPhoto.mock.calls.map((c) => c[0]).sort()).toEqual(["p1", "p2"]);
  });

  it("retries after a failure rather than remembering it forever", async () => {
    fetchPhoto.mockRejectedValueOnce(new Error("offline"));
    const first = render(<PlayerAvatar userId="p1" firstName="A" lastName="R" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(1));
    first.unmount();

    fetchPhoto.mockResolvedValue(photoBlob());
    render(<PlayerAvatar userId="p1" firstName="A" lastName="R" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(2));
  });

  it("brings the initials back when the photo is removed", async () => {
    // The regression this exists for, found in a browser after a real remove:
    // Radix keeps the image's loading status on the Avatar ROOT and shows the
    // fallback only while it is not "loaded". Unmounting the AvatarImage does
    // not reset it, so the circle rendered EMPTY — no photo and no initials.
    //
    // jsdom decodes nothing, so Radix's internal `new window.Image()` never
    // reaches "loaded" on its own and the fallback would show whatever the
    // component did — a version of this test without the stub below passes
    // against the bug. Verified by deleting the fix and watching it still pass.
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      referrerPolicy = "";
      crossOrigin: string | null = null;
      #listeners = new Map<string, Set<() => void>>();
      #src = "";
      addEventListener(type: string, listener: () => void) {
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
        this.#listeners.get(type)!.add(listener);
      }
      removeEventListener(type: string, listener: () => void) {
        this.#listeners.get(type)?.delete(listener);
      }
      set src(value: string) {
        this.#src = value;
        // Radix attaches its listeners before assigning `src`, so a task later
        // is the right moment to say "decoded".
        setTimeout(() => {
          this.onload?.();
          for (const listener of this.#listeners.get("load") ?? []) listener();
        }, 0);
      }
      get src() {
        return this.#src;
      }
    }
    vi.stubGlobal("Image", LoadedImage);

    fetchPhoto.mockResolvedValue(photoBlob());
    const view = render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" version="v1" hasPhoto />);

    // The photo really did load, so the fallback is gone. Without this half the
    // assertion below proves nothing.
    await waitFor(() => expect(screen.queryByText("AR")).toBeNull());
    expect(document.querySelector("img")).not.toBeNull();

    // What a successful DELETE /api/me/photo leaves: no photo, no timestamp.
    view.rerender(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" version={null} hasPhoto={false} />);

    await waitFor(() => expect(screen.getByText("AR")).toBeInTheDocument());
    expect(document.querySelector("img")).toBeNull();
  });

  it("survives a browser that will not mint an object URL", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: undefined, revokeObjectURL: undefined }));
    fetchPhoto.mockResolvedValue(photoBlob());
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalled());
    expect(screen.getByText("AR")).toBeInTheDocument();
  });
});
