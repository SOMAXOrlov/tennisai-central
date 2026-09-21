// ============================================================================
// HTTP route tests — /api/players/:playerId/equipment, /api/equipment/:id and
// the item photo under /api/equipment/:id/photo.
//
// The list is readable by whoever may act for the player; items are the
// player's alone to write; the PHOTO is the player's alone to see, and a
// non-owner gets the same sentence a missing photo gets. Specs are validated
// against the item's category. Deleting an item deletes its picture.
// ============================================================================
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { equipmentRouter } from "../equipment/routes";
import { PHOTO_UNAVAILABLE_MESSAGE } from "../photos/upload";
import { MAX_PHOTO_BYTES, photoPath, setUploadsDirForTests, writePhoto } from "../photos/storage";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", equipmentRouter]]);

const PLAYER = "player-1";
const COACH = "coach-1";
const STRANGER = "stranger-1";
const ITEM = "eq-1";
const STORED_ID = "c".repeat(32);
const OLD_ID = "d".repeat(32);

let dir: string;
let jpeg: Buffer;
let tall: Buffer;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tennisai-equipment-photo-"));
  setUploadsDirForTests(dir);
  const make = (w: number, h: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 40, g: 90, b: 180 } } });
  jpeg = await make(800, 600).jpeg({ quality: 90 }).toBuffer();
  tall = await make(600, 1600).png().toBuffer();
});

afterAll(async () => {
  setUploadsDirForTests(undefined);
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function itemRow(over: Record<string, unknown> = {}) {
  return {
    id: ITEM,
    playerId: PLAYER,
    category: "racket",
    name: "Pro Staff 97",
    brand: "Wilson",
    model: "Pro Staff 97 v14",
    notes: null,
    acquiredDate: "2025-09-01",
    condition: "Good",
    productId: null,
    specs: { gripSize: "L3", weightG: 315 },
    photoId: null,
    photoUpdatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function assigned() {
  db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
}
function unrelated() {
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue(null);
  db.guardianship.findUnique.mockResolvedValue(null);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/players/:playerId/equipment", () => {
  it("presents specs and photo presence, and lets an assigned coach read", async () => {
    assigned();
    db.equipmentItem.findMany.mockResolvedValue([itemRow({ photoId: STORED_ID, photoUpdatedAt: new Date("2026-09-01T08:00:00.000Z") })]);
    const res = await request(app).get(`/api/players/${PLAYER}/equipment`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      specs: { gripSize: "L3", weightG: 315 },
      photoId: STORED_ID,
      photoUpdatedAt: "2026-09-01T08:00:00.000Z",
    });
  });

  it("403s a stranger", async () => {
    unrelated();
    const res = await request(app).get(`/api/players/${PLAYER}/equipment`).set("Authorization", bearer(STRANGER));
    expect(res.status).toBe(403);
    expect(db.equipmentItem.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/players/:playerId/equipment — specs by category", () => {
  it("stores string specs on a string", async () => {
    db.equipmentItem.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => itemRow({ ...data }));
    const res = await request(app)
      .post(`/api/players/${PLAYER}/equipment`)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "string", name: "ALU Power", specs: { gaugeMm: 1.25, setLengthM: 12 } });
    expect(res.status).toBe(201);
    expect(firstCallArg<{ data: { specs: unknown } }>(db.equipmentItem.create).data.specs).toEqual({ gaugeMm: 1.25, setLengthM: 12 });
  });

  it("refuses a gauge on a racket", async () => {
    const res = await request(app)
      .post(`/api/players/${PLAYER}/equipment`)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "racket", name: "Frame", specs: { gaugeMm: 1.25 } });
    expect(res.status).toBe(400);
    expect(db.equipmentItem.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown category and a malformed acquired date", async () => {
    const bad1 = await request(app).post(`/api/players/${PLAYER}/equipment`).set("Authorization", bearer(PLAYER)).send({ category: "hat", name: "x" });
    const bad2 = await request(app).post(`/api/players/${PLAYER}/equipment`).set("Authorization", bearer(PLAYER)).send({ category: "shoes", name: "x", acquiredDate: "1/9/2025" });
    expect(bad1.status).toBe(400);
    expect(bad2.status).toBe(400);
  });

  it("only the player adds to their own bag", async () => {
    const res = await request(app).post(`/api/players/${PLAYER}/equipment`).set("Authorization", bearer(COACH)).send({ category: "balls", name: "Cans" });
    expect(res.status).toBe(403);
  });
});

describe("set and reel fields — strings only", () => {
  it("a new reel starts full", async () => {
    db.equipmentItem.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => itemRow({ ...data }));
    const res = await request(app)
      .post(`/api/players/${PLAYER}/equipment`)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "string", name: "ALU Power reel", stringForm: "reel", stringLengthM: 200 });
    expect(res.status).toBe(201);
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.equipmentItem.create).data;
    expect(data).toMatchObject({ stringForm: "reel", stringLengthM: 200, stringRemainingM: 200 });
    expect(res.body.data).toMatchObject({ stringForm: "reel", stringLengthM: 200, stringRemainingM: 200 });
  });

  it("refuses a reel on a racket", async () => {
    const res = await request(app)
      .post(`/api/players/${PLAYER}/equipment`)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "racket", name: "Frame", stringForm: "reel", stringLengthM: 200 });
    expect(res.status).toBe(400);
    expect(db.equipmentItem.create).not.toHaveBeenCalled();
  });

  it("correcting a reel's length moves what is left by the same amount", async () => {
    db.equipmentItem.findUnique.mockResolvedValue(
      itemRow({ category: "string", stringForm: "reel", stringLengthM: 100, stringRemainingM: 60, usedUpAt: null }),
    );
    db.equipmentItem.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => itemRow({ ...data }));
    const res = await request(app).patch(`/api/equipment/${ITEM}`).set("Authorization", bearer(PLAYER)).send({ stringLengthM: 200 });
    expect(res.status).toBe(200);
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.equipmentItem.update).data).toMatchObject({ stringLengthM: 200, stringRemainingM: 160, usedUpAt: null });
  });

  it("still accepts a legacy setLengthM spec on an existing string", async () => {
    db.equipmentItem.findUnique.mockResolvedValue(itemRow({ category: "string", specs: { gaugeMm: 1.25, setLengthM: 12 } }));
    db.equipmentItem.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => itemRow({ ...data }));
    const res = await request(app)
      .patch(`/api/equipment/${ITEM}`)
      .set("Authorization", bearer(PLAYER))
      .send({ specs: { gaugeMm: 1.3, setLengthM: 12 } });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/equipment/:id", () => {
  it("drops the old specs when the category changes and none are sent", async () => {
    db.equipmentItem.findUnique.mockResolvedValue(itemRow());
    db.equipmentItem.update.mockResolvedValue(itemRow({ category: "shoes", specs: null }));
    const res = await request(app).patch(`/api/equipment/${ITEM}`).set("Authorization", bearer(PLAYER)).send({ category: "shoes" });
    expect(res.status).toBe(200);
    const arg = firstCallArg<{ data: { specs: unknown } }>(db.equipmentItem.update);
    expect(arg.data.specs).not.toBeUndefined();
    expect(res.body.data).not.toHaveProperty("specs");
  });

  it("validates new specs against the new category", async () => {
    db.equipmentItem.findUnique.mockResolvedValue(itemRow());
    db.equipmentItem.update.mockResolvedValue(itemRow({ category: "shoes", specs: { size: "EU 42.5", surface: "clay" } }));
    const res = await request(app)
      .patch(`/api/equipment/${ITEM}`)
      .set("Authorization", bearer(PLAYER))
      .send({ category: "shoes", specs: { size: "EU 42.5", surface: "clay" } });
    expect(res.status).toBe(200);
    expect(firstCallArg<{ data: { specs: unknown } }>(db.equipmentItem.update).data.specs).toEqual({ size: "EU 42.5", surface: "clay" });
  });
});

describe("photos — POST /api/equipment/:id/photo", () => {
  it("re-encodes to WebP without cropping, writes the file and stamps the row; replaces the previous one", async () => {
    await writePhoto(OLD_ID, jpeg);
    db.equipmentItem.findUnique.mockResolvedValue(itemRow({ photoId: OLD_ID, photoUpdatedAt: new Date() }));
    db.equipmentItem.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => itemRow({ ...data }));

    const res = await request(app).post(`/api/equipment/${ITEM}/photo`).set("Authorization", bearer(PLAYER)).attach("photo", tall, "racket.png");
    expect(res.status).toBe(200);

    const arg = firstCallArg<{ data: { photoId: string; photoUpdatedAt: Date } }>(db.equipmentItem.update);
    expect(arg.data.photoId).toMatch(/^[0-9a-f]{32}$/);
    expect(arg.data.photoUpdatedAt).toBeInstanceOf(Date);
    expect(res.body.data.photoId).toBe(arg.data.photoId);

    // Bytes first, then sharp: a path input leaves libvips holding the file,
    // which on Windows blocks the temp directory's removal in afterAll.
    const stored = await sharp(await readFile(photoPath(arg.data.photoId))).metadata();
    expect(stored.format).toBe("webp");
    // 600×1600 fitted inside 1024: the long edge is 1024 and the ratio is kept.
    expect(stored.height).toBe(1024);
    expect(stored.width).toBe(384);
    expect(existsSync(photoPath(OLD_ID))).toBe(false);
  });

  it("403s anyone but the owner, even an assigned coach", async () => {
    assigned();
    db.equipmentItem.findUnique.mockResolvedValue(itemRow());
    const res = await request(app).post(`/api/equipment/${ITEM}/photo`).set("Authorization", bearer(COACH)).attach("photo", jpeg, "x.jpg");
    expect(res.status).toBe(403);
    expect(db.equipmentItem.update).not.toHaveBeenCalled();
  });

  it("415s a file that is not an image, whatever it is called", async () => {
    db.equipmentItem.findUnique.mockResolvedValue(itemRow());
    const res = await request(app)
      .post(`/api/equipment/${ITEM}/photo`)
      .set("Authorization", bearer(PLAYER))
      .attach("photo", Buffer.from("%PDF-1.4 not a picture"), "racket.jpg");
    expect(res.status).toBe(415);
    expect(db.equipmentItem.update).not.toHaveBeenCalled();
  });

  it("413s an oversized upload from the declared length alone", async () => {
    db.equipmentItem.findUnique.mockResolvedValue(itemRow());
    const res = await request(app)
      .post(`/api/equipment/${ITEM}/photo`)
      .set("Authorization", bearer(PLAYER))
      .attach("photo", Buffer.alloc(MAX_PHOTO_BYTES + 1024, 1), "huge.jpg");
    expect(res.status).toBe(413);
    expect(db.equipmentItem.update).not.toHaveBeenCalled();
  });
});

describe("photos — GET /api/equipment/:id/photo", () => {
  it("serves the owner's photo as WebP with an ETag", async () => {
    await writePhoto(STORED_ID, await sharp(jpeg).webp().toBuffer());
    db.equipmentItem.findUnique.mockResolvedValue({ playerId: PLAYER, photoId: STORED_ID, photoUpdatedAt: new Date("2026-09-01T08:00:00.000Z") });
    const res = await request(app).get(`/api/equipment/${ITEM}/photo`).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/image\/webp/);
    expect(res.headers.etag).toBeTruthy();
    expect(res.headers["cache-control"]).toContain("private");
  });

  it("gives an assigned coach the same 403 sentence a missing photo gets", async () => {
    assigned();
    db.equipmentItem.findUnique.mockResolvedValue({ playerId: PLAYER, photoId: STORED_ID, photoUpdatedAt: new Date() });
    const asCoach = await request(app).get(`/api/equipment/${ITEM}/photo`).set("Authorization", bearer(COACH));
    expect(asCoach.status).toBe(403);
    expect(asCoach.body.message).toBe(PHOTO_UNAVAILABLE_MESSAGE);

    db.equipmentItem.findUnique.mockResolvedValue({ playerId: PLAYER, photoId: null, photoUpdatedAt: null });
    const none = await request(app).get(`/api/equipment/${ITEM}/photo`).set("Authorization", bearer(PLAYER));
    expect(none.status).toBe(404);
    expect(none.body.message).toBe(PHOTO_UNAVAILABLE_MESSAGE);

    db.equipmentItem.findUnique.mockResolvedValue(null);
    const missing = await request(app).get(`/api/equipment/nope/photo`).set("Authorization", bearer(PLAYER));
    expect(missing.status).toBe(403);
    expect(missing.body.message).toBe(PHOTO_UNAVAILABLE_MESSAGE);
  });
});

describe("photos — removal", () => {
  it("DELETE /equipment/:id/photo clears the row and removes the file", async () => {
    await writePhoto(STORED_ID, jpeg);
    db.equipmentItem.findUnique.mockResolvedValue(itemRow({ photoId: STORED_ID, photoUpdatedAt: new Date() }));
    db.equipmentItem.update.mockResolvedValue(itemRow());
    const res = await request(app).delete(`/api/equipment/${ITEM}/photo`).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.equipmentItem.update)).toEqual({ where: { id: ITEM }, data: { photoId: null, photoUpdatedAt: null } });
    expect(existsSync(photoPath(STORED_ID))).toBe(false);
  });

  it("DELETE /equipment/:id takes the picture with the row", async () => {
    await writePhoto(STORED_ID, jpeg);
    db.equipmentItem.findUnique.mockResolvedValue(itemRow({ photoId: STORED_ID, photoUpdatedAt: new Date() }));
    db.equipmentItem.delete.mockResolvedValue(itemRow());
    const res = await request(app).delete(`/api/equipment/${ITEM}`).set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(existsSync(photoPath(STORED_ID))).toBe(false);
  });
});
