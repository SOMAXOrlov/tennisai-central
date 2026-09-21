// ============================================================================
// The photo upload chain, shared by every route that accepts a picture:
// the profile photo (./routes.ts) and equipment photos (../equipment/routes.ts).
//
// Two gates, both giving the same plain sentence, because neither is enough
// on its own:
//
//   FIRST, from the declared Content-Length — the cheap one. An obviously
//   oversized request is refused without parsing a byte of multipart.
//
//   SECOND, from multer's `limits.fileSize` — the real one. A client can
//   under-declare or omit its length; multer counts what actually arrives and
//   aborts the stream at the cap, so the whole body is never in memory.
//
// Multipart is parsed into memory rather than a temp file: the ORIGINAL bytes
// never touch the disk, EXIF and GPS intact, which is the whole point of the
// re-encode that every caller does next.
//
// The body is drained before answering a 413. Replying while it is still
// arriving makes the client report a connection reset instead of reading the
// 413, which is the difference between "your photo is too big" and "the site
// is broken". Draining costs bandwidth we have already been sent and no memory.
// ============================================================================
import type { Request, RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../http";
import { MAX_PHOTO_BYTES, MULTIPART_OVERHEAD_BYTES, sniffImageMime } from "./storage";

/** The form field the browser must use. */
export const PHOTO_FIELD = "photo";

/** Human-readable size cap, for the messages that quote it. */
export const MAX_PHOTO_MB = Math.round(MAX_PHOTO_BYTES / (1024 * 1024));

/**
 * The one answer to every "no" on a photo read. Used verbatim for the 403 and
 * the 404 so the two are distinguishable only by status, never by content —
 * and so neither hints at whether a photo is there.
 */
export const PHOTO_UNAVAILABLE_MESSAGE = "No photo available";

const TOO_LARGE = `That photo is over ${MAX_PHOTO_MB} MB. Please choose a smaller one.`;
const WRONG_SHAPE = `Send one image file in a "${PHOTO_FIELD}" field.`;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 2, parts: 3 },
});

const contentLengthGate: RequestHandler = (req, res, next) => {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (!Number.isFinite(declared) || declared <= MAX_PHOTO_BYTES + MULTIPART_OVERHEAD_BYTES) {
    next();
    return;
  }
  const tooLarge = () => {
    if (res.headersSent) return;
    res.status(413).json({ message: TOO_LARGE });
  };
  req.on("end", tooLarge);
  req.on("aborted", tooLarge);
  req.resume();
};

const parseSinglePhoto: RequestHandler = (req, res, next) => {
  upload.single(PHOTO_FIELD)(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(413, TOO_LARGE));
      // A wrong field name, too many parts, too many files: all client shape
      // errors, none of them worth a bespoke sentence each.
      return next(new HttpError(400, WRONG_SHAPE));
    }
    return next(err);
  });
};

/** Mount before the handler: `router.post(path, ...photoUpload, asyncHandler(...))`. */
export const photoUpload: RequestHandler[] = [contentLengthGate, parseSinglePhoto];

/**
 * The uploaded image's bytes, checked by magic bytes — the declared
 * Content-Type and the filename are both written by the client, so neither is
 * evidence of anything. Throws the 400 / 415 the profile route always has.
 */
export function uploadedImage(req: Request): Buffer {
  const file = req.file;
  if (!file || file.buffer.length === 0) throw new HttpError(400, WRONG_SHAPE);
  if (sniffImageMime(file.buffer) === null) {
    throw new HttpError(
      415,
      "That file is not a JPEG, PNG or WebP image. Please choose a photo in one of those formats.",
    );
  }
  return file.buffer;
}
