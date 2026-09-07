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

import { PlayerAvatar, initialsFrom } from "@/components/PlayerAvatar";

const createObjectURL = vi.fn(() => "blob:photo-1");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  fetchPhoto.mockReset();
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

  it("survives a browser that will not mint an object URL", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: undefined, revokeObjectURL: undefined }));
    fetchPhoto.mockResolvedValue(photoBlob());
    render(<PlayerAvatar userId="p1" firstName="Alex" lastName="Rivera" />);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalled());
    expect(screen.getByText("AR")).toBeInTheDocument();
  });
});
