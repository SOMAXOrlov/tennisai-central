// ============================================================================
// Profile photos — upload, remove, and the guarded read.
//
// Three routes, mounted at /api (see index.ts) because they span two paths:
//
//   POST   /api/me/photo          upload or replace YOUR OWN photo
//   DELETE /api/me/photo          remove it
//   GET    /api/players/:id/photo stream one, behind authorization
//
// WHY UPLOAD IS SELF-ONLY
// A coach cannot upload a photo *for* a player, and there is no route that
// would let them. Consent for an image of a person belongs to that person; an
// endpoint that let one account put a face on another's profile would be a
// consent bypass with a UI, whatever the relationship between them.
//
// WHY A REFUSAL AND A MISSING PHOTO CARRY THE SAME BODY
// Someone probing "does this child have a picture?" learns from any difference
// they can measure. So authorization runs BEFORE existence: an actor who may
// not see the photo is refused identically whether one exists or not, an
// unknown user id is refused the same way (it also cannot be used to enumerate
// accounts), and the 403 and the 404 carry byte-identical bodies. What is left
// is the status code, and it only separates "you may not look" from "there is
// nothing to look at, and you were entitled to know that".
// ============================================================================

import { Router } from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { assertCanViewPlayerPhoto } from "../authz";
import { isMinorAccount } from "../auth/guardianConsent";
import { publicUser } from "../lib/publicUser";
import {
  MAX_PHOTO_BYTES,
  MULTIPART_OVERHEAD_BYTES,
  deletePhoto,
  newPhotoId,
  readPhoto,
  reencodeToSquareWebp,
  sniffImageMime,
  writePhoto,
  STORED_PHOTO_MIME,
} from "./storage";

/**
 * The one answer to every "no". Used verbatim for the 403 and the 404 so the
 * two are distinguishable only by status, never by content — and so neither
 * hints at whether a photo is there.
 */
export const PHOTO_UNAVAILABLE_MESSAGE = "No photo available";

/** Human-readable size cap, for the messages that quote it. */
const MAX_PHOTO_MB = Math.round(MAX_PHOTO_BYTES / (1024 * 1024));

/**
 * Multipart parsing, into memory rather than a temp file. The whole point of
 * this endpoint is that the ORIGINAL bytes never touch the disk — writing them
 * to a spool directory first, EXIF and GPS intact, would undo the feature even
 * if the file were deleted a moment later.
 *
 * `limits` is the real cap: multer aborts the stream the moment the file passes
 * fileSize, so a hostile 500 MB body is never buffered. The Content-Length
 * pre-check below is the cheaper first line, not the only one.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 2, parts: 3 },
});

/** The form field the browser must use. */
const PHOTO_FIELD = "photo";

export const photosRouter = Router();

// ── POST /api/me/photo ──────────────────────────────────────────────────────

photosRouter.post(
  "/me/photo",
  requireAuth,
  // Two gates, both giving the same plain sentence, because neither is enough
  // on its own:
  //
  //   HERE, from the declared Content-Length — the cheap one. An obviously
  //   oversized request is refused without parsing a byte of multipart.
  //
  //   BELOW, from multer's `limits.fileSize` — the real one. A client can
  //   under-declare or omit its length; multer counts what actually arrives and
  //   aborts the stream at the cap, so the whole body is never in memory.
  //
  // The body is drained before answering. Replying while it is still arriving
  // makes the client report a connection reset instead of reading the 413,
  // which is the difference between "your photo is too big" and "the site is
  // broken". Draining costs bandwidth we have already been sent and no memory.
  (req, res, next) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (!Number.isFinite(declared) || declared <= MAX_PHOTO_BYTES + MULTIPART_OVERHEAD_BYTES) {
      next();
      return;
    }
    const tooLarge = () => {
      if (res.headersSent) return;
      res.status(413).json({ message: `That photo is over ${MAX_PHOTO_MB} MB. Please choose a smaller one.` });
    };
    req.on("end", tooLarge);
    req.on("aborted", tooLarge);
    req.resume();
  },
  (req, res, next) => {
    upload.single(PHOTO_FIELD)(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new HttpError(413, `That photo is over ${MAX_PHOTO_MB} MB. Please choose a smaller one.`),
          );
        }
        // A wrong field name, too many parts, too many files: all client shape
        // errors, none of them worth a bespoke sentence each.
        return next(new HttpError(400, `Send one image file in a "${PHOTO_FIELD}" field.`));
      }
      return next(err);
    });
  },
  asyncHandler(async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file || file.buffer.length === 0) {
      throw new HttpError(400, `Send one image file in a "${PHOTO_FIELD}" field.`);
    }

    // By magic bytes. The declared Content-Type and the filename are both
    // written by the client, so neither is evidence of anything.
    const sniffed = sniffImageMime(file.buffer);
    if (sniffed === null) {
      throw new HttpError(
        415,
        "That file is not a JPEG, PNG or WebP image. Please choose a photo in one of those formats.",
      );
    }

    // THE STRIP. sharp decodes the pixels and writes a fresh WebP; nothing asks
    // it to carry metadata across, so EXIF, GPS, XMP and the embedded thumbnail
    // are all gone from what gets written. The original buffer is never stored.
    let reencoded: Buffer;
    try {
      reencoded = await reencodeToSquareWebp(file.buffer);
    } catch {
      // The bytes had the right magic number and still would not decode: a
      // truncated download, a fuzzed file, a format sharp was built without.
      throw new HttpError(400, "That image could not be read. Please try another photo.");
    }

    const previous = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { photoId: true },
    });
    if (!previous) throw new HttpError(404, "User not found");

    // New file first, then the row, then the old file. In that order a crash at
    // any point leaves either the old photo or the new one intact — never a row
    // pointing at bytes that are not there.
    const photoId = newPhotoId();
    await writePhoto(photoId, reencoded);

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { photoId, photoUpdatedAt: new Date(), photoMime: STORED_PHOTO_MIME },
    });

    if (previous.photoId && previous.photoId !== photoId) {
      await deletePhoto(previous.photoId);
    }

    return ok(res, publicUser(user), "Photo updated");
  }),
);

// ── DELETE /api/me/photo ────────────────────────────────────────────────────

photosRouter.delete(
  "/me/photo",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const current = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { photoId: true },
    });
    if (!current) throw new HttpError(404, "User not found");

    // Row first, then the bytes. If the delete of the file fails the request
    // fails too (deletePhoto only swallows "already gone"), so nobody is told
    // their photo was removed while it is still on the disk.
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { photoId: null, photoUpdatedAt: null, photoMime: null },
    });
    await deletePhoto(current.photoId);

    // Idempotent: removing a photo that is not there is a success, because the
    // caller's goal — "there is no photo of me" — already holds.
    return ok(res, publicUser(user), "Photo removed");
  }),
);

// ── GET /api/players/:id/photo ──────────────────────────────────────────────

const photoParams = z.object({ id: z.string().trim().min(1) });

photosRouter.get(
  "/players/:id/photo",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { id } = photoParams.parse(req.params);
    const actorId = req.userId!;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        photoId: true,
        photoMime: true,
        photoUpdatedAt: true,
        dateOfBirth: true,
        guardianConsentRequired: true,
        ageConfirmedAt: true,
      },
    });

    // An unknown id is refused exactly like an unauthorized one. Answering 404
    // here would turn this endpoint into a way to test whether an account
    // exists, one guess at a time.
    if (!target) throw new HttpError(403, PHOTO_UNAVAILABLE_MESSAGE);

    // AUTHORIZATION BEFORE EXISTENCE. This ordering is the whole guarantee: a
    // caller who may not look gets the same refusal whether or not there is a
    // photo, so the response cannot be used to find out.
    try {
      await assertCanViewPlayerPhoto(actorId, target.id, isMinorAccount(target));
    } catch (err) {
      // Replace the ladder's specific wording with the uniform refusal; let
      // anything that is not a refusal (401, a database failure) through.
      if (err instanceof HttpError && err.status === 403) {
        throw new HttpError(403, PHOTO_UNAVAILABLE_MESSAGE);
      }
      throw err;
    }

    if (!target.photoId || !target.photoUpdatedAt) {
      throw new HttpError(404, PHOTO_UNAVAILABLE_MESSAGE);
    }

    // A strong ETag over the storage id and the update time: a replaced photo
    // gets a new id AND a new timestamp, so it can never be served from a stale
    // cache, and an unchanged one costs a 304 instead of the bytes.
    //
    // Hashed rather than concatenated so the random storage id never leaves the
    // server, not even inside a cache validator a proxy might log.
    const etag = `"${createHash("sha256")
      .update(`${target.photoId}:${target.photoUpdatedAt.toISOString()}`)
      .digest("hex")}"`;

    // `private` so a shared proxy never holds a copy of somebody's face, and
    // `must-revalidate` with max-age=0 so the browser always asks and the ETag
    // does the work. nosniff is set here rather than left to helmet: helmet is
    // not mounted in the route-test harness, and this is the one response in
    // the API that returns bytes a browser will render.
    res.set("Cache-Control", "private, max-age=0, must-revalidate");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("ETag", etag);

    if (req.fresh) {
      res.status(304).end();
      return;
    }

    // Read into memory rather than piping: these files are a few tens of
    // kilobytes, and a replace that deletes the old file mid-stream throws
    // EPERM on Windows.
    const bytes = await readPhoto(target.photoId);
    if (!bytes) {
      // The row claims a photo and the file is gone — a restore that missed
      // UPLOADS_DIR, or a half-finished manual clean-up. Same body as every
      // other "no", so drop the validator: there is nothing here to cache.
      res.removeHeader("ETag");
      throw new HttpError(404, PHOTO_UNAVAILABLE_MESSAGE);
    }

    // Set LAST, and only on the way out with real bytes. Setting it earlier
    // makes express keep it for the error body too — a JSON refusal labelled
    // image/webp, which is both wrong and, with nosniff, unreadable.
    res.set("Content-Type", target.photoMime ?? STORED_PHOTO_MIME);
    res.status(200).send(bytes);
  }),
);
