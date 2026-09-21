// ============================================================================
// Equipment — the things in a player's bag.
//
// Mounted at /api — routes use full paths (/players/:playerId/equipment,
// /equipment/:id, /equipment/:id/photo).
//
// Reading the LIST is open to whoever may act for the player (their connected
// coach, a consenting guardian) so a coach can check a racket's condition
// before a session. Writing items is the player's alone. PHOTOS are stricter
// still, by the owner's decision of 2026-09-21: the player and nobody else,
// and a non-owner gets the same 403 and the same sentence a missing photo
// gets, so the answer never says whether a picture exists.
//
// `specs` holds the few category-specific facts a coach actually asks about
// (grip size, gauge, shoe size…), validated per category and stored as JSON
// so a new fact is a schema line here and a label in the locales, not a
// migration.
// ============================================================================
import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, type EquipmentItem } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { assertCanActOnPlayer } from "../authz";
import { PHOTO_UNAVAILABLE_MESSAGE, photoUpload, uploadedImage } from "../photos/upload";
import {
  ITEM_PHOTO_MAX_EDGE,
  STORED_PHOTO_MIME,
  deletePhoto,
  newPhotoId,
  readPhoto,
  reencodeToWebpWithin,
  writePhoto,
} from "../photos/storage";

export const equipmentRouter = Router();
equipmentRouter.use(requireAuth);

export const CATEGORIES = ["racket", "string", "shoes", "balls", "accessories"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SURFACES = ["clay", "hard", "grass", "indoor", "all"] as const;

/** ISO day, the form the client has always sent for acquiredDate. */
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-MM-dd");

// Per category. `.strict()` so a gauge on a racket or a grip size on shoes is
// refused rather than stored and never shown.
const SPECS: Record<Category, z.ZodTypeAny> = {
  racket: z
    .object({
      gripSize: z.string().trim().min(1).max(10).optional(),
      weightG: z.number().min(200).max(400).optional(),
      stringPattern: z.string().trim().min(1).max(10).optional(),
    })
    .strict(),
  string: z
    .object({
      gaugeMm: z.number().min(1).max(1.6).optional(),
      // A pre-cut set (12 m) or a reel (100 / 200 m) — what is in the bag.
      setLengthM: z.number().min(1).max(300).optional(),
    })
    .strict(),
  shoes: z
    .object({
      size: z.string().trim().min(1).max(12).optional(),
      surface: z.enum(SURFACES).optional(),
    })
    .strict(),
  balls: z.object({ quantity: z.number().int().min(1).max(500).optional() }).strict(),
  accessories: z.object({}).strict(),
};

const baseSchema = z.object({
  category: z.enum(CATEGORIES),
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  acquiredDate: isoDay.optional(),
  condition: z.string().trim().max(40).optional(),
  specs: z.record(z.unknown()).nullable().optional(),
});

function validateSpecs(
  category: Category,
  specs: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (specs === undefined) return undefined;
  if (specs === null) return Prisma.JsonNull;
  const parsed = SPECS[category].parse(specs) as Record<string, unknown>;
  // Drop what the form left empty so the row does not fill with nulls.
  const clean = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return Object.keys(clean).length === 0 ? Prisma.JsonNull : (clean as Prisma.InputJsonValue);
}

function present(e: EquipmentItem) {
  return {
    id: e.id,
    playerId: e.playerId,
    category: e.category,
    name: e.name,
    brand: e.brand ?? undefined,
    model: e.model ?? undefined,
    notes: e.notes ?? undefined,
    acquiredDate: e.acquiredDate ?? undefined,
    condition: e.condition ?? undefined,
    specs: (e.specs ?? undefined) as Record<string, unknown> | undefined,
    // Presence only. The bytes come from GET /equipment/:id/photo, owner-only.
    photoId: e.photoId ?? undefined,
    photoUpdatedAt: e.photoUpdatedAt ? e.photoUpdatedAt.toISOString() : undefined,
  };
}

async function ownedItem(id: string, userId: string): Promise<EquipmentItem> {
  const item = await prisma.equipmentItem.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, "Equipment not found");
  if (item.playerId !== userId) throw new HttpError(403, "Not your equipment");
  return item;
}

equipmentRouter.get(
  "/players/:playerId/equipment",
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.params.playerId !== req.userId) await assertCanActOnPlayer(req.userId!, req.params.playerId);
    const rows = await prisma.equipmentItem.findMany({
      where: { playerId: req.params.playerId },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, rows.map(present));
  }),
);

equipmentRouter.post(
  "/players/:playerId/equipment",
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.params.playerId !== req.userId) throw new HttpError(403, "You can only add your own equipment");
    const d = baseSchema.parse(req.body);
    const specs = validateSpecs(d.category, d.specs);
    const created = await prisma.equipmentItem.create({
      data: { ...d, specs, playerId: req.params.playerId },
    });
    return ok(res, present(created), "Item added", 201);
  }),
);

equipmentRouter.patch(
  "/equipment/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const item = await ownedItem(req.params.id, req.userId!);
    const d = baseSchema.partial().parse(req.body);
    // Specs are validated against the category the row will HAVE after this
    // change; a category change without new specs drops the old ones, which
    // would otherwise leave a racket carrying a gauge.
    const category = (d.category ?? item.category) as Category;
    const specs =
      d.specs !== undefined
        ? validateSpecs(category, d.specs)
        : d.category && d.category !== item.category
          ? Prisma.JsonNull
          : undefined;
    const updated = await prisma.equipmentItem.update({
      where: { id: req.params.id },
      data: { ...d, specs },
    });
    return ok(res, present(updated), "Item updated");
  }),
);

equipmentRouter.delete(
  "/equipment/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const item = await ownedItem(req.params.id, req.userId!);
    await prisma.equipmentItem.delete({ where: { id: req.params.id } });
    // The row is gone; a picture nobody can reach must not stay on the disk.
    await deletePhoto(item.photoId);
    return ok(res, null, "Item deleted");
  }),
);

// ── Photos: one per item, the owner's alone ──────────────────────────────────

equipmentRouter.post(
  "/equipment/:id/photo",
  ...photoUpload,
  asyncHandler(async (req: AuthedRequest, res) => {
    const item = await ownedItem(req.params.id, req.userId!);
    const bytes = uploadedImage(req);
    // Fit inside, not a square crop: a racket is tall, a shoe is wide, and a
    // cover crop would cut the head off one and the toe off the other.
    let reencoded: Buffer;
    try {
      reencoded = await reencodeToWebpWithin(bytes, ITEM_PHOTO_MAX_EDGE);
    } catch {
      throw new HttpError(400, "That image could not be read. Please try another photo.");
    }
    const photoId = newPhotoId();
    await writePhoto(photoId, reencoded);
    const updated = await prisma.equipmentItem.update({
      where: { id: item.id },
      data: { photoId, photoUpdatedAt: new Date() },
    });
    if (item.photoId && item.photoId !== photoId) await deletePhoto(item.photoId);
    return ok(res, present(updated), "Photo saved");
  }),
);

equipmentRouter.delete(
  "/equipment/:id/photo",
  asyncHandler(async (req: AuthedRequest, res) => {
    const item = await ownedItem(req.params.id, req.userId!);
    const updated = await prisma.equipmentItem.update({
      where: { id: item.id },
      data: { photoId: null, photoUpdatedAt: null },
    });
    await deletePhoto(item.photoId);
    return ok(res, present(updated), "Photo removed");
  }),
);

equipmentRouter.get(
  "/equipment/:id/photo",
  asyncHandler(async (req: AuthedRequest, res) => {
    const item = await prisma.equipmentItem.findUnique({
      where: { id: req.params.id },
      select: { playerId: true, photoId: true, photoUpdatedAt: true },
    });
    // Not the owner, or no such item: the same sentence, so neither answer
    // reveals whether the item or its picture exists.
    if (!item || item.playerId !== req.userId) throw new HttpError(403, PHOTO_UNAVAILABLE_MESSAGE);
    if (!item.photoId || !item.photoUpdatedAt) throw new HttpError(404, PHOTO_UNAVAILABLE_MESSAGE);

    const etag = `"${createHash("sha256")
      .update(`${item.photoId}:${item.photoUpdatedAt.toISOString()}`)
      .digest("hex")}"`;
    res.set("Cache-Control", "private, max-age=0, must-revalidate");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("ETag", etag);
    if (req.fresh) {
      res.status(304).end();
      return;
    }
    const bytes = await readPhoto(item.photoId);
    if (!bytes) {
      res.removeHeader("ETag");
      throw new HttpError(404, PHOTO_UNAVAILABLE_MESSAGE);
    }
    res.set("Content-Type", STORED_PHOTO_MIME);
    res.status(200).send(bytes);
  }),
);
