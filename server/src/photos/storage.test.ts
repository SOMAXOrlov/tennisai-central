// ============================================================================
// The storage layer, and the claim the whole feature rests on.
//
// The headline spec here is "the re-encode really removes EXIF/GPS". It is
// written to be falsifiable in both directions: it FIRST proves the fixture it
// uploads genuinely carries a GPS IFD (by walking the TIFF structure in the
// JPEG's APP1 segment and finding the GPS pointer tag and the four coordinate
// tags), and only then asserts that the stored bytes carry no EXIF at all. A
// test that merely asserted "no GPS in the output" would pass just as happily
// against a fixture that never had any.
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  MAX_PHOTO_BYTES,
  PHOTO_MAX_EDGE,
  deletePhoto,
  newPhotoId,
  photoPath,
  readPhoto,
  reencodeToSquareWebp,
  setUploadsDirForTests,
  sniffImageMime,
  uploadsDir,
  writePhoto,
} from "./storage";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tennisai-photo-storage-"));
  setUploadsDirForTests(dir);
});

afterAll(async () => {
  setUploadsDirForTests(undefined);
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A synthetic photo. Never a real person, and never a real place. */
async function syntheticJpeg(width = 900, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 190, g: 110, b: 40 } } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * The same photo, stamped with a GPS position and a camera make — exactly the
 * metadata a phone attaches, and exactly what must not survive an upload.
 * libvips exposes the EXIF GPS IFD as "ifd3", which is why the key looks odd.
 */
async function jpegWithGpsExif(): Promise<Buffer> {
  return sharp(await syntheticJpeg())
    .withMetadata({
      exif: {
        IFD0: { Make: "TennisAI-Test-Camera", Model: "SyntheticPhone" },
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "41/1 23/1 1234/100",
          GPSLongitudeRef: "E",
          GPSLongitude: "2/1 10/1 4321/100",
        },
      },
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** EXIF tag ids present in IFD0 and in the GPS sub-IFD of an EXIF block. */
function exifTagIds(exif: Buffer): { ifd0: number[]; gps: number[] } {
  const offset = exif.subarray(0, 6).toString("latin1") === "Exif\0\0" ? 6 : 0;
  const tiff = exif.subarray(offset);
  const littleEndian = tiff.subarray(0, 2).toString("latin1") === "II";
  const u16 = (at: number) => (littleEndian ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (littleEndian ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  const readIfd = (at: number) => {
    const entries = u16(at);
    const tags = new Map<number, number>();
    for (let i = 0; i < entries; i++) {
      const entry = at + 2 + i * 12;
      tags.set(u16(entry), u32(entry + 8));
    }
    return tags;
  };
  const ifd0 = readIfd(u32(4));
  const gpsPointer = ifd0.get(0x8825); // GPSInfoIFDPointer
  return { ifd0: [...ifd0.keys()], gps: gpsPointer ? [...readIfd(gpsPointer).keys()] : [] };
}

// ── The format check ────────────────────────────────────────────────────────

describe("sniffImageMime", () => {
  it("recognises a real JPEG, PNG and WebP by their leading bytes", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } })
      .jpeg()
      .toBuffer();
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } })
      .png()
      .toBuffer();
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } })
      .webp()
      .toBuffer();

    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(webp)).toBe("image/webp");
  });

  it("refuses a PDF whatever it is called", () => {
    // The exact shape of the attack the route has to stop: a file named
    // "selfie.jpg", sent as image/jpeg, that is a PDF.
    expect(sniffImageMime(Buffer.from("%PDF-1.7\n%\xc7\xec\x8f\xa2\n", "latin1"))).toBeNull();
  });

  it("refuses other things that are not images", () => {
    expect(sniffImageMime(Buffer.from("GIF89a", "latin1"))).toBeNull(); // a real image, not accepted
    expect(sniffImageMime(Buffer.from("PK\x03\x04", "latin1"))).toBeNull(); // zip / docx
    expect(sniffImageMime(Buffer.from("#!/bin/sh\n", "latin1"))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
    expect(sniffImageMime(Buffer.from([0xff, 0xd8]))).toBeNull(); // truncated JPEG marker
  });

  it("is not fooled by a RIFF container that is not WebP", () => {
    const wav = Buffer.concat([
      Buffer.from("RIFF", "latin1"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WAVE", "latin1"),
    ]);
    expect(sniffImageMime(wav)).toBeNull();
  });
});

// ── The re-encode: the metadata strip ───────────────────────────────────────

describe("reencodeToSquareWebp", () => {
  it("removes the EXIF GPS position that the uploaded file carried", async () => {
    const original = await jpegWithGpsExif();

    // Half one: the fixture really does carry GPS. Without this the assertion
    // below would pass against any image at all.
    const originalMeta = await sharp(original).metadata();
    expect(originalMeta.exif).toBeDefined();
    const originalTags = exifTagIds(originalMeta.exif!);
    expect(originalTags.ifd0).toContain(0x8825); // GPSInfoIFDPointer
    expect(originalTags.gps).toEqual(
      expect.arrayContaining([0x0001, 0x0002, 0x0003, 0x0004]), // lat ref, lat, lon ref, lon
    );
    expect(original.includes(Buffer.from("Exif\0\0", "latin1"))).toBe(true);
    expect(original.includes(Buffer.from("TennisAI-Test-Camera", "latin1"))).toBe(true);

    // Half two: what would actually be written to disk.
    const stored = await reencodeToSquareWebp(original);

    const storedMeta = await sharp(stored).metadata();
    expect(storedMeta.exif).toBeUndefined();
    expect(storedMeta.xmp).toBeUndefined();
    expect(storedMeta.icc).toBeUndefined();
    // Nothing recognisable in the raw bytes either — not the EXIF marker, not
    // the camera make, not the coordinate rationals.
    expect(stored.includes(Buffer.from("Exif\0\0", "latin1"))).toBe(false);
    expect(stored.includes(Buffer.from("TennisAI-Test-Camera", "latin1"))).toBe(false);
    expect(stored.includes(Buffer.from("SyntheticPhone", "latin1"))).toBe(false);
  });

  it("outputs a square WebP of at most 512 pixels", async () => {
    const meta = await sharp(await reencodeToSquareWebp(await syntheticJpeg(2400, 1600))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(PHOTO_MAX_EDGE);
    expect(meta.height).toBe(PHOTO_MAX_EDGE);
  });

  it("does not enlarge an image smaller than the target", async () => {
    // A 200×300 upload becomes a real 200×200 crop, not a blurred 512×512.
    const meta = await sharp(await reencodeToSquareWebp(await syntheticJpeg(200, 300))).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it("re-encodes a PNG and a WebP too, not only JPEG", async () => {
    const png = await sharp({ create: { width: 700, height: 700, channels: 4, background: "#0f0" } })
      .png()
      .toBuffer();
    const webp = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#00f" } })
      .webp()
      .toBuffer();

    for (const input of [png, webp]) {
      const meta = await sharp(await reencodeToSquareWebp(input)).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(meta.height);
      expect(meta.width).toBeLessThanOrEqual(PHOTO_MAX_EDGE);
    }
  });

  it("turns a phone's 5 MB photo into something small enough to serve", async () => {
    const big = await syntheticJpeg(4000, 3000);
    const stored = await reencodeToSquareWebp(big);
    expect(stored.length).toBeLessThan(MAX_PHOTO_BYTES / 10);
  });
});

// ── Names and paths ─────────────────────────────────────────────────────────

describe("storage ids and paths", () => {
  it("mints 32 unguessable hex characters, all different", () => {
    const ids = new Set(Array.from({ length: 200 }, newPhotoId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("puts the file inside the uploads directory, named by the id alone", () => {
    const id = newPhotoId();
    expect(photoPath(id)).toBe(path.join(uploadsDir(), `${id}.webp`));
  });

  it("refuses to build a path from anything that is not a storage id", () => {
    // Neither of these can be produced by newPhotoId, but photoId is a value
    // that has been round-tripped through the database, and a path built from
    // an unchecked string is how traversal happens.
    for (const hostile of ["../../../etc/passwd", "..", "a/b", "", "p1", "ABCDEF", "0".repeat(31)]) {
      expect(() => photoPath(hostile)).toThrow(/malformed storage id/i);
    }
  });
});

// ── Reading, writing, deleting ──────────────────────────────────────────────

describe("writePhoto / readPhoto / deletePhoto", () => {
  it("writes bytes that read back byte-identical, leaving no temp file", async () => {
    const id = newPhotoId();
    const bytes = await reencodeToSquareWebp(await syntheticJpeg());
    await writePhoto(id, bytes);

    expect(await readPhoto(id)).toEqual(bytes);
    expect(await readFile(photoPath(id))).toEqual(bytes);
    expect(existsSync(`${photoPath(id)}.tmp`)).toBe(false);
  });

  it("reads null rather than throwing when the file is not there", async () => {
    expect(await readPhoto(newPhotoId())).toBeNull();
  });

  it("deletes the file from disk", async () => {
    const id = newPhotoId();
    await writePhoto(id, await reencodeToSquareWebp(await syntheticJpeg()));
    expect(existsSync(photoPath(id))).toBe(true);

    await deletePhoto(id);
    expect(existsSync(photoPath(id))).toBe(false);
  });

  it("treats deleting an absent, null or malformed photo as success", async () => {
    await expect(deletePhoto(newPhotoId())).resolves.toBeUndefined();
    await expect(deletePhoto(null)).resolves.toBeUndefined();
    await expect(deletePhoto(undefined)).resolves.toBeUndefined();
    await expect(deletePhoto("../../secrets")).resolves.toBeUndefined();
  });

  it("does not delete anything outside the store when handed a traversal id", async () => {
    const bystander = path.join(dir, "bystander.txt");
    await writeFile(bystander, "not a photo");
    await deletePhoto(`..${path.sep}bystander.txt`);
    expect(existsSync(bystander)).toBe(true);
  });

  it("creates the uploads directory on first write", async () => {
    const nested = path.join(dir, "nested", "deeper");
    setUploadsDirForTests(nested);
    try {
      const id = newPhotoId();
      await writePhoto(id, Buffer.from("webp-ish"));
      expect(existsSync(photoPath(id))).toBe(true);
    } finally {
      setUploadsDirForTests(dir);
    }
  });
});
