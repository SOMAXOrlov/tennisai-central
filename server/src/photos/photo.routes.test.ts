// ============================================================================
// Profile photos — the endpoints, and the rule that matters.
//
// The owner decided a minor may have a photo and that it is their coach's to
// see and nobody else's. He was told the risk and chose it, so the restriction
// has to be REAL: enforced on the image request itself, provably, with the
// UI nowhere in the picture. That is what most of this file is.
//
// The rest pins the upload gates that keep the strip honest — size, magic
// bytes, self-only — and the two properties a prober must not be able to use:
// that a refusal and a missing photo carry the same body, and that whether a
// photo exists is never readable by someone who may not see it.
//
// Style follows src/test/harness.ts: real routing, real requireAuth with
// signed tokens, real zod, real authz helpers, real error handler. Only Prisma
// is faked — the filesystem is a genuine temporary directory, because "the old
// file was deleted from disk" is not a claim a mock can make.
// ============================================================================

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

vi.mock("../db", async () => ({ prisma: (await import("../test/harness")).createPrismaMock() }));

import { prisma } from "../db";
import { PHOTO_UNAVAILABLE_MESSAGE, photosRouter } from "./routes";
import { MAX_PHOTO_BYTES, photoPath, setUploadsDirForTests, writePhoto } from "./storage";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "../test/harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", photosRouter]]);

const ADULT = "user-adult"; // a player over the threshold
const MINOR = "user-minor"; // a player under it — the case this exists for
const COACH = "user-coach";
const OTHER_PLAYER = "user-other-player";
const OBSERVER = "user-observer"; // an unrelated parent account
const GUARDIAN = "user-guardian"; // the minor's parent

const STORED_ID = "a".repeat(32);
const OLD_ID = "b".repeat(32);
const PHOTO_UPDATED_AT = new Date("2026-09-01T08:00:00.000Z");

let dir: string;
let jpeg: Buffer;
let png: Buffer;
let webp: Buffer;
let storedBytes: Buffer;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tennisai-photo-routes-"));
  setUploadsDirForTests(dir);

  const make = (w: number, h: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 180, g: 90, b: 40 } } });
  jpeg = await make(900, 600).jpeg({ quality: 90 }).toBuffer();
  png = await make(700, 700).png().toBuffer();
  webp = await make(640, 480).webp().toBuffer();
  storedBytes = await make(512, 512).webp().toBuffer();
});

afterAll(async () => {
  setUploadsDirForTests(undefined);
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// ── The world each spec starts from ─────────────────────────────────────────

/**
 * A user row as the read endpoint selects it. `ageConfirmedAt` set + no date of
 * birth is the adult shape (every seeded account looks like this);
 * `dateOfBirth` in 2012 is the minor shape.
 */
interface Row {
  id: string;
  photoId: string | null;
  photoMime: string | null;
  photoUpdatedAt: Date | null;
  dateOfBirth: string | null;
  guardianConsentRequired: boolean;
  ageConfirmedAt: Date | null;
  role?: string;
}

function adultRow(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    photoId: STORED_ID,
    photoMime: "image/webp",
    photoUpdatedAt: PHOTO_UPDATED_AT,
    dateOfBirth: null,
    guardianConsentRequired: false,
    ageConfirmedAt: new Date("2026-01-01T00:00:00.000Z"),
    role: "player",
    ...overrides,
  };
}

function minorRow(id: string, overrides: Partial<Row> = {}): Row {
  return adultRow(id, { dateOfBirth: "2012-03-04", guardianConsentRequired: true, ...overrides });
}

/** Rows the mocked `user.findUnique` will answer with, keyed by id. */
let rows: Record<string, Row>;

beforeEach(() => {
  vi.clearAllMocks();
  rows = {
    [ADULT]: adultRow(ADULT),
    [MINOR]: minorRow(MINOR),
    [COACH]: adultRow(COACH, { photoId: null, photoUpdatedAt: null, photoMime: null, role: "coach" }),
    [OTHER_PLAYER]: adultRow(OTHER_PLAYER, { photoId: null, role: "player" }),
    [OBSERVER]: adultRow(OBSERVER, { photoId: null, role: "observer" }),
    [GUARDIAN]: adultRow(GUARDIAN, { photoId: null, role: "observer" }),
  };

  // ONE mock serves both the endpoint's target lookup and `getRole` inside the
  // authz helpers, so it has to answer by id rather than by call order.
  db.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
    return Promise.resolve(rows[args.where.id] ?? null);
  });
  db.user.update.mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
    Promise.resolve({ ...rows[args.where.id], ...args.data, firstName: "Test", lastName: "Person" }),
  );

  // Nobody is related to anybody until a spec says so.
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue(null);
  db.guardianship.findUnique.mockResolvedValue(null);
});

/** The coach is actively assigned to the target. */
const withCoachAssignment = () => db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
/** An active connection exists in one direction or the other. */
const withConnection = () => db.connectionRequest.findFirst.mockResolvedValue({ id: "conn-1" });
/** A guardianship with consent recorded. */
const withConsentedGuardianship = () => db.guardianship.findUnique.mockResolvedValue({ parentalConsent: true });
/** A guardianship where nobody ever consented. */
const withUnconsentedGuardianship = () => db.guardianship.findUnique.mockResolvedValue({ parentalConsent: false });

// ── POST /api/me/photo ──────────────────────────────────────────────────────

describe("POST /api/me/photo", () => {
  it("401s an unauthenticated upload before touching the database", async () => {
    const res = await request(app).post("/api/me/photo").attach("photo", jpeg, "selfie.jpg");
    expect(res.status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("accepts a real JPEG and records the storage id, time and mime", async () => {
    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", jpeg, "selfie.jpg");

    expect(res.status).toBe(200);
    const written = firstCallArg<{ where: { id: string }; data: Record<string, unknown> }>(db.user.update);
    expect(written.where.id).toBe(ADULT); // pinned to the token, never the body
    expect(written.data.photoMime).toBe("image/webp");
    expect(written.data.photoUpdatedAt).toBeInstanceOf(Date);
    expect(written.data.photoId).toMatch(/^[0-9a-f]{32}$/);
    // Not the uploaded filename, and not the user id.
    expect(written.data.photoId).not.toBe("selfie.jpg");
    expect(written.data.photoId).not.toBe(ADULT);
    expect(existsSync(photoPath(written.data.photoId as string))).toBe(true);
  });

  it("stores a WebP, not the bytes it was given", async () => {
    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", jpeg, "selfie.jpg");
    expect(res.status).toBe(200);

    const { data } = firstCallArg<{ data: { photoId: string } }>(db.user.update);
    // Read into a buffer first: handing sharp a PATH leaves the file open long
  // enough that Windows refuses to unlink the temp directory afterwards.
  const meta = await sharp(await readFile(photoPath(data.photoId))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.exif).toBeUndefined();
  });

  it("accepts PNG and WebP as well", async () => {
    for (const [bytes, name] of [
      [png, "avatar.png"],
      [webp, "avatar.webp"],
    ] as const) {
      vi.clearAllMocks();
      db.user.findUnique.mockImplementation((a: { where: { id: string } }) => Promise.resolve(rows[a.where.id]));
      db.user.update.mockResolvedValue({ ...rows[ADULT], firstName: "T", lastName: "P" });
      const res = await request(app)
        .post("/api/me/photo")
        .set("Authorization", bearer(ADULT))
        .attach("photo", bytes, name);
      expect(res.status).toBe(200);
    }
  });

  it("refuses a 6 MB upload without writing anything", async () => {
    // A real JPEG header followed by six megabytes: the size gate has to fire
    // before anything looks at the pixels.
    const sixMb = Buffer.concat([jpeg, Buffer.alloc(6 * 1024 * 1024)]);
    expect(sixMb.length).toBeGreaterThan(MAX_PHOTO_BYTES);

    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", sixMb, "huge.jpg");

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/5 MB/);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a file just over the cap, on multer's streaming count", async () => {
    // Deliberately sized so the WHOLE REQUEST is under the Content-Length gate
    // (cap + 64 KB of multipart slack) while the FILE is over the cap. Only
    // multer's byte counter can catch this one, which is the gate that also
    // catches a client that lies about or omits its Content-Length.
    const justOver = Buffer.concat([jpeg, Buffer.alloc(MAX_PHOTO_BYTES)]);
    expect(justOver.length).toBeGreaterThan(MAX_PHOTO_BYTES);
    expect(justOver.length).toBeLessThan(MAX_PHOTO_BYTES + 32 * 1024);

    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", justOver, "big.jpg");

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/5 MB/);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a .jpg that is really a PDF, whatever Content-Type it claims", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1");
    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", pdf, { filename: "selfie.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(415);
    expect(res.body.message).toMatch(/JPEG, PNG or WebP/);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a GIF — a real image, but not one of the three accepted", async () => {
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00", "latin1");
    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", gif, { filename: "loop.gif", contentType: "image/gif" });
    expect(res.status).toBe(415);
  });

  it("refuses a request with no file at all", async () => {
    const res = await request(app).post("/api/me/photo").set("Authorization", bearer(ADULT));
    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a file sent under the wrong field name", async () => {
    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("avatar", jpeg, "selfie.jpg");
    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("has no route for uploading a photo on behalf of somebody else", async () => {
    // Consent for an image of a person belongs to that person, so a coach
    // cannot put a face on a player's profile. There is no such path to call.
    withCoachAssignment();
    const res = await request(app)
      .post(`/api/players/${MINOR}/photo`)
      .set("Authorization", bearer(COACH))
      .attach("photo", jpeg, "child.jpg");
    expect(res.status).toBe(404);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("deletes the previous file from disk when a photo is replaced", async () => {
    await writePhoto(OLD_ID, storedBytes);
    expect(existsSync(photoPath(OLD_ID))).toBe(true);
    rows[ADULT] = adultRow(ADULT, { photoId: OLD_ID });

    const res = await request(app)
      .post("/api/me/photo")
      .set("Authorization", bearer(ADULT))
      .attach("photo", jpeg, "new.jpg");

    expect(res.status).toBe(200);
    const { data } = firstCallArg<{ data: { photoId: string } }>(db.user.update);
    expect(existsSync(photoPath(data.photoId))).toBe(true);
    expect(existsSync(photoPath(OLD_ID))).toBe(false);
  });
});

// ── DELETE /api/me/photo ────────────────────────────────────────────────────

describe("DELETE /api/me/photo", () => {
  it("401s an unauthenticated caller", async () => {
    const res = await request(app).delete("/api/me/photo");
    expect(res.status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("nulls all three columns and deletes the file", async () => {
    const id = "c".repeat(32);
    await writePhoto(id, storedBytes);
    rows[ADULT] = adultRow(ADULT, { photoId: id });

    const res = await request(app).delete("/api/me/photo").set("Authorization", bearer(ADULT));

    expect(res.status).toBe(200);
    const written = firstCallArg<{ where: { id: string }; data: Record<string, unknown> }>(db.user.update);
    expect(written.where.id).toBe(ADULT);
    expect(written.data).toEqual({ photoId: null, photoUpdatedAt: null, photoMime: null });
    expect(existsSync(photoPath(id))).toBe(false);
  });

  it("succeeds when there was no photo to begin with", async () => {
    rows[ADULT] = adultRow(ADULT, { photoId: null, photoUpdatedAt: null, photoMime: null });
    const res = await request(app).delete("/api/me/photo").set("Authorization", bearer(ADULT));
    expect(res.status).toBe(200);
  });
});

// ── GET /api/players/:id/photo — an adult's photo ───────────────────────────

describe("GET /api/players/:id/photo — an adult", () => {
  beforeEach(async () => {
    await writePhoto(STORED_ID, storedBytes);
  });

  it("401s an unauthenticated caller", async () => {
    const res = await request(app).get(`/api/players/${ADULT}/photo`);
    expect(res.status).toBe(401);
  });

  it("serves it to the person themselves", async () => {
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(ADULT));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(Buffer.from(res.body)).toEqual(storedBytes);
  });

  it("serves it to their assigned coach", async () => {
    withCoachAssignment();
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("serves it to a connected coach", async () => {
    withConnection();
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("serves it over the ordinary readable ladder — a connected observer counts", async () => {
    // An adult chose to publish their own face to their connections. This is
    // the rung the minor rule below deliberately removes.
    withConnection();
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(OBSERVER));
    expect(res.status).toBe(200);
  });

  it("refuses an unrelated account", async () => {
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(OTHER_PLAYER));
    expect(res.status).toBe(403);
  });

  it("sets private caching, nosniff and a strong ETag", async () => {
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(ADULT));
    expect(res.headers["cache-control"]).toBe("private, max-age=0, must-revalidate");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers.etag).toMatch(/^"[0-9a-f]{64}"$/); // strong, not W/
    // The random storage id never appears in a header a proxy might log.
    expect(JSON.stringify(res.headers)).not.toContain(STORED_ID);
  });

  it("answers 304 for an unchanged photo and 200 once it changes", async () => {
    const first = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(ADULT));
    const etag = first.headers.etag;

    const cached = await request(app)
      .get(`/api/players/${ADULT}/photo`)
      .set("Authorization", bearer(ADULT))
      .set("If-None-Match", etag);
    expect(cached.status).toBe(304);

    // A replacement changes both the storage id and the timestamp.
    const newId = "d".repeat(32);
    await writePhoto(newId, storedBytes);
    rows[ADULT] = adultRow(ADULT, { photoId: newId, photoUpdatedAt: new Date("2026-09-02T09:00:00.000Z") });

    const busted = await request(app)
      .get(`/api/players/${ADULT}/photo`)
      .set("Authorization", bearer(ADULT))
      .set("If-None-Match", etag);
    expect(busted.status).toBe(200);
    expect(busted.headers.etag).not.toBe(etag);
  });
});

// ── GET /api/players/:id/photo — A MINOR. The rule this feature exists for. ─

describe("GET /api/players/:id/photo — a minor", () => {
  beforeEach(async () => {
    await writePhoto(STORED_ID, storedBytes);
  });

  it("serves it to the minor themselves", async () => {
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(MINOR));
    expect(res.status).toBe(200);
  });

  it("serves it to their assigned coach", async () => {
    withCoachAssignment();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("serves it to a coach holding an active connection", async () => {
    withConnection();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(COACH));
    expect(res.status).toBe(200);
  });

  it("serves it to a guardian whose consent is recorded", async () => {
    withConsentedGuardianship();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(GUARDIAN));
    expect(res.status).toBe(200);
  });

  it("REFUSES another player, even one connected to them", async () => {
    withConnection();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(OTHER_PLAYER));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: PHOTO_UNAVAILABLE_MESSAGE });
  });

  it("REFUSES an observer holding an active connection", async () => {
    // The rung an adult's photo travels along. A child's does not.
    withConnection();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(OBSERVER));
    expect(res.status).toBe(403);
  });

  it("REFUSES a guardian who never consented, connection or not", async () => {
    withUnconsentedGuardianship();
    withConnection();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(GUARDIAN));
    expect(res.status).toBe(403);
  });

  it("REFUSES an unrelated account", async () => {
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(OTHER_PLAYER));
    expect(res.status).toBe(403);
  });

  it("applies the rule from the date of birth alone, with no consent flag set", async () => {
    // The flag is signup's verdict; a row that only carries a date of birth
    // must reach the same answer, or an imported or edited account slips out.
    rows[MINOR] = adultRow(MINOR, { dateOfBirth: "2012-03-04", guardianConsentRequired: false });
    withConnection();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(OBSERVER));
    expect(res.status).toBe(403);
  });

  it("applies the rule to an account whose age is not known at all", async () => {
    // No date of birth and no age confirmation: fails closed, because nothing
    // on the row says this is an adult.
    rows[MINOR] = adultRow(MINOR, { dateOfBirth: null, ageConfirmedAt: null, guardianConsentRequired: false });
    withConnection();
    const res = await request(app).get(`/api/players/${MINOR}/photo`).set("Authorization", bearer(OBSERVER));
    expect(res.status).toBe(403);
  });
});

// ── What a prober can and cannot learn ──────────────────────────────────────

describe("GET /api/players/:id/photo — a prober learns nothing", () => {
  it("refuses identically whether the minor has a photo or not", async () => {
    await writePhoto(STORED_ID, storedBytes);

    const withPhoto = await request(app)
      .get(`/api/players/${MINOR}/photo`)
      .set("Authorization", bearer(OTHER_PLAYER));

    rows[MINOR] = minorRow(MINOR, { photoId: null, photoUpdatedAt: null, photoMime: null });
    const withoutPhoto = await request(app)
      .get(`/api/players/${MINOR}/photo`)
      .set("Authorization", bearer(OTHER_PLAYER));

    // Same status, same body. This is the whole point of authorising before
    // looking at whether a photo exists.
    expect(withoutPhoto.status).toBe(withPhoto.status);
    expect(withoutPhoto.status).toBe(403);
    expect(withoutPhoto.text).toBe(withPhoto.text);
  });

  it("gives the 403 and the 404 byte-identical bodies", async () => {
    await writePhoto(STORED_ID, storedBytes);

    const refused = await request(app)
      .get(`/api/players/${MINOR}/photo`)
      .set("Authorization", bearer(OTHER_PLAYER));

    rows[ADULT] = adultRow(ADULT, { photoId: null, photoUpdatedAt: null, photoMime: null });
    const missing = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(ADULT));

    expect(refused.status).toBe(403);
    expect(missing.status).toBe(404);
    expect(refused.text).toBe(missing.text);
    expect(refused.body).toEqual({ message: PHOTO_UNAVAILABLE_MESSAGE });
    expect(missing.body).toEqual({ message: PHOTO_UNAVAILABLE_MESSAGE });
  });

  it("cannot be used to find out which accounts exist", async () => {
    // An unknown id answers exactly like an unauthorised one — 404 here would
    // turn this into an account-enumeration oracle, one guess at a time.
    const unknown = await request(app)
      .get("/api/players/does-not-exist/photo")
      .set("Authorization", bearer(OTHER_PLAYER));
    const unauthorised = await request(app)
      .get(`/api/players/${MINOR}/photo`)
      .set("Authorization", bearer(OTHER_PLAYER));

    expect(unknown.status).toBe(403);
    expect(unknown.text).toBe(unauthorised.text);
  });

  it("answers the same way when the row claims a photo the disk does not have", async () => {
    // A restore that missed UPLOADS_DIR. The endpoint must not 500.
    rows[ADULT] = adultRow(ADULT, { photoId: "e".repeat(32) });
    const res = await request(app).get(`/api/players/${ADULT}/photo`).set("Authorization", bearer(ADULT));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: PHOTO_UNAVAILABLE_MESSAGE });
  });
});
