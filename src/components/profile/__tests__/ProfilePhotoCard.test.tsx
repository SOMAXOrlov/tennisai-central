// ============================================================================
// The upload control's states.
//
// The one that matters most for a person actually using this: the accepted
// formats and the size cap are on screen BEFORE the file picker opens. Being
// told "too big" after choosing a photo on a phone, on mobile data, is a
// wasted minute and an avoidable apology.
//
// The client-side type and size checks are pinned too — as a courtesy that
// saves a doomed upload, never as the gate. The server checks the magic bytes
// and counts the arriving stream whatever this component decides, and the
// backend specs are where that is proved.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@/types";

const upload = vi.fn<(file: File, onProgress?: (f: number) => void) => Promise<unknown>>();
const remove = vi.fn<() => Promise<unknown>>();
const fetchPhoto = vi.fn<(userId: string) => Promise<Blob | null>>();

vi.mock("@/api/endpoints/photos", async () => {
  const actual = await vi.importActual<typeof import("@/api/endpoints/photos")>("@/api/endpoints/photos");
  return {
    ...actual,
    photosApi: {
      upload: (file: File, onProgress?: (f: number) => void) => upload(file, onProgress),
      remove: () => remove(),
      fetchPhoto: (id: string) => fetchPhoto(id),
    },
  };
});

const refreshUser = vi.fn(async () => {});
let currentUser: Partial<User> | null = null;

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    user: currentUser,
    isAuthenticated: !!currentUser,
    isLoading: false,
    hasRole: () => false,
    login: vi.fn(),
    signUp: vi.fn(),
    logout: vi.fn(),
    refreshUser,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/feedback", async () => {
  const actual = await vi.importActual<typeof import("@/lib/feedback")>("@/lib/feedback");
  return {
    ...actual,
    toastSuccess: (key: string) => toastSuccess(key),
    toastError: (key: string, err?: unknown) => toastError(key, err),
  };
});

import { ProfilePhotoCard } from "@/components/profile/ProfilePhotoCard";
import { MAX_PHOTO_BYTES } from "@/api/endpoints/photos";

function jpegFile(name = "selfie.jpg", size = 1024): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeEach(() => {
  upload.mockReset();
  remove.mockReset();
  fetchPhoto.mockReset();
  refreshUser.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchPhoto.mockResolvedValue(null);
  currentUser = { id: "p1", firstName: "Alex", lastName: "Rivera", photoId: null, photoUpdatedAt: null };
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfilePhotoCard — before anything is chosen", () => {
  it("states the accepted formats and the size cap up front", () => {
    render(<ProfilePhotoCard />);
    expect(screen.getByText(/JPEG, PNG or WebP, up to 5 MB/i)).toBeInTheDocument();
  });

  it("offers Choose photo, and no Save, Cancel or Remove", () => {
    render(<ProfilePhotoCard />);
    expect(screen.getByRole("button", { name: /choose photo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save photo$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove photo/i })).not.toBeInTheDocument();
  });

  it("says Replace and offers Remove once a photo exists", () => {
    currentUser = { ...currentUser, photoId: "a".repeat(32), photoUpdatedAt: "2026-09-01T08:00:00.000Z" };
    render(<ProfilePhotoCard />);
    expect(screen.getByRole("button", { name: /replace photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove photo/i })).toBeInTheDocument();
  });

  it("says plainly what happens to the photo's location data", () => {
    render(<ProfilePhotoCard />);
    expect(screen.getByText(/location and camera data are removed/i)).toBeInTheDocument();
  });
});

describe("ProfilePhotoCard — choosing a file", () => {
  it("previews it and offers Save and Cancel", async () => {
    const user = userEvent.setup();
    render(<ProfilePhotoCard />);

    await user.upload(screen.getByLabelText(/choose a profile photo file/i), jpegFile());

    expect(screen.getByAltText(/the photo you just chose/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save photo$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByText(/selfie\.jpg/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("drops the choice on Cancel", async () => {
    const user = userEvent.setup();
    render(<ProfilePhotoCard />);

    await user.upload(screen.getByLabelText(/choose a profile photo file/i), jpegFile());
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByAltText(/the photo you just chose/i)).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a file of the wrong type, and says which are accepted", async () => {
    // `applyAccept: false` so the file gets past the input's `accept` filter,
    // which is where a real browser's picker would usually stop it. The check
    // still has to exist and still has to be tested: `accept` is a hint the
    // picker may offer to bypass ("All files"), and on some platforms it is
    // matched loosely or ignored.
    const user = userEvent.setup({ applyAccept: false });
    render(<ProfilePhotoCard />);

    const pdf = new File(["%PDF-1.7"], "notes.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/choose a profile photo file/i), pdf);

    expect(screen.getByRole("alert")).toHaveTextContent(/not a JPEG, PNG or WebP image/i);
    expect(screen.queryByRole("button", { name: /^save photo$/i })).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses a file over the cap, and quotes the cap", async () => {
    const user = userEvent.setup();
    render(<ProfilePhotoCard />);

    await user.upload(
      screen.getByLabelText(/choose a profile photo file/i),
      jpegFile("huge.jpg", MAX_PHOTO_BYTES + 1),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/over 5 MB/i);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("ProfilePhotoCard — saving", () => {
  it("uploads the chosen file, refreshes the account and confirms", async () => {
    const user = userEvent.setup();
    upload.mockResolvedValue({ data: {} });
    render(<ProfilePhotoCard />);

    const file = jpegFile();
    await user.upload(screen.getByLabelText(/choose a profile photo file/i), file);
    await user.click(screen.getByRole("button", { name: /^save photo$/i }));

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0][0]).toBe(file);
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("photo.toast.saved");
    // The choice is cleared, so the card is back to offering a new one.
    await waitFor(() => expect(screen.queryByRole("button", { name: /^save photo$/i })).not.toBeInTheDocument());
  });

  it("shows the real percentage the upload reports, not an invented one", async () => {
    const user = userEvent.setup();
    let release: (() => void) | null = null;
    upload.mockImplementation((_file, onProgress) => {
      onProgress?.(0.42);
      return new Promise<unknown>((resolve) => {
        release = () => resolve({ data: {} });
      });
    });
    render(<ProfilePhotoCard />);

    await user.upload(screen.getByLabelText(/choose a profile photo file/i), jpegFile());
    await user.click(screen.getByRole("button", { name: /^save photo$/i }));

    await waitFor(() => expect(screen.getByText(/42%/)).toBeInTheDocument());
    release?.();
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it("shows a plain uploading line while no total is known", async () => {
    const user = userEvent.setup();
    let release: (() => void) | null = null;
    // No progress callback at all — a browser that never reports a total.
    upload.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          release = () => resolve({ data: {} });
        }),
    );
    render(<ProfilePhotoCard />);

    await user.upload(screen.getByLabelText(/choose a profile photo file/i), jpegFile());
    await user.click(screen.getByRole("button", { name: /^save photo$/i }));

    await waitFor(() => expect(screen.getByText(/uploading your photo/i)).toBeInTheDocument());
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    release?.();
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it("reports a failure and keeps the chosen file so it can be retried", async () => {
    const user = userEvent.setup();
    upload.mockRejectedValue(new Error("nope"));
    render(<ProfilePhotoCard />);

    await user.upload(screen.getByLabelText(/choose a profile photo file/i), jpegFile());
    await user.click(screen.getByRole("button", { name: /^save photo$/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("photo.toast.saveFailed", expect.anything()));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^save photo$/i })).toBeInTheDocument();
  });
});

describe("ProfilePhotoCard — removing", () => {
  beforeEach(() => {
    currentUser = {
      id: "p1",
      firstName: "Alex",
      lastName: "Rivera",
      photoId: "a".repeat(32),
      photoUpdatedAt: "2026-09-01T08:00:00.000Z",
    };
  });

  it("removes it, refreshes the account and confirms", async () => {
    const user = userEvent.setup();
    remove.mockResolvedValue({ data: {} });
    render(<ProfilePhotoCard />);

    await user.click(screen.getByRole("button", { name: /remove photo/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("photo.toast.removed");
  });

  it("reports a failed removal instead of claiming it worked", async () => {
    const user = userEvent.setup();
    remove.mockRejectedValue(new Error("nope"));
    render(<ProfilePhotoCard />);

    await user.click(screen.getByRole("button", { name: /remove photo/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("photo.toast.removeFailed", expect.anything()));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
