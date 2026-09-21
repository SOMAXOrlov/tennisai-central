// ============================================================================
// String setups — drawing from the bag.
//
// A job that names the string item it was cut from changes that item in the
// same transaction: a set is used up outright, a reel loses the metres and is
// used up when nothing usable is left. A hybrid cut from one reel sums both
// sides. Deleting the job puts the metres back. Foreign, non-string and
// already-used items are refused before anything is written.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { stringSetupsRouter } from "../stringSetups/routes";
import { bearer, createTestApp, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", stringSetupsRouter]]);

const PLAYER = "player-1";
const REEL = "eq-reel";
const SET = "eq-set";

const base = { racketItemId: "eq-1", tensionMainsKg: 23, strungAt: "2026-06-01" };

function bag(over: Record<string, unknown>) {
  return {
    id: REEL,
    playerId: PLAYER,
    category: "string",
    name: "Luxilon ALU Power 125",
    stringForm: "reel",
    stringLengthM: 200,
    stringRemainingM: 114,
    usedUpAt: null,
    ...over,
  };
}

function created(data: Record<string, unknown>) {
  return {
    id: "ss-1",
    playerId: PLAYER,
    mainsProductId: null,
    crossesProductId: null,
    mainsCustomName: null,
    crossesCustomName: null,
    tensionCrossesKg: null,
    prestretch: null,
    mainsLengthM: null,
    crossesLengthM: null,
    mainsSource: null,
    crossesSource: null,
    mainsItemId: null,
    crossesItemId: null,
    stringerName: null,
    costEur: null,
    hoursPlayed: null,
    retiredAt: null,
    retiredReason: null,
    comfortNote: null,
    notes: null,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    ...data,
    strungAt: new Date(String(data.strungAt)),
  };
}

const post = (body: Record<string, unknown>) =>
  request(app).post(`/api/players/${PLAYER}/string-setups`).set("Authorization", bearer(PLAYER)).send(body);

/** The equipmentItem.update call for one item: `{ where, data }`. */
function updateFor(id: string) {
  const call = db.equipmentItem.update.mock.calls.find((c) => (c[0] as { where: { id: string } }).where.id === id);
  if (!call) throw new Error(`no update for ${id}`);
  return (call[0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db));
  db.equipmentItem.findUnique.mockResolvedValue({ playerId: PLAYER });
  db.stringSetup.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => created(data));
  db.equipmentItem.update.mockResolvedValue({});
});

describe("POST — drawing from a reel", () => {
  it("takes the metres off the reel and carries its name and form onto the job", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({})]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 12 });
    expect(res.status).toBe(201);
    expect(res.body.data.mainsItemId).toBe(REEL);
    expect(res.body.data.mainsCustomName).toBe("Luxilon ALU Power 125");
    expect(res.body.data.mainsSource).toBe("reel");
    expect(updateFor(REEL)).toEqual({ stringRemainingM: 102, usedUpAt: null });
  });

  it("marks the reel used up when the job takes the last usable metres", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ stringRemainingM: 12.2 })]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 12 });
    expect(res.status).toBe(201);
    const data = updateFor(REEL);
    expect(data.stringRemainingM).toBeCloseTo(0.2);
    expect(data.usedUpAt).toBeInstanceOf(Date);
  });

  it("sums both sides of a hybrid cut from one reel before deducting once", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({})]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 6, crossesItemId: REEL, crossesLengthM: 6 });
    expect(res.status).toBe(201);
    expect(db.equipmentItem.update).toHaveBeenCalledTimes(1);
    expect(updateFor(REEL).stringRemainingM).toBe(102);
  });

  it("400s when the reel cannot cover the job, and writes nothing", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ stringRemainingM: 9 })]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 12 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only 9 m left/);
    expect(db.stringSetup.create).not.toHaveBeenCalled();
    expect(db.equipmentItem.update).not.toHaveBeenCalled();
  });

  it("400s when a reel is named without the metres cut from it", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({})]);
    const res = await post({ ...base, mainsItemId: REEL });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/how many metres/);
  });
});

describe("POST — drawing from a set", () => {
  it("uses the whole set up, even when only half went into a hybrid", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ id: SET, stringForm: "set", stringLengthM: 12, stringRemainingM: 12, name: "Solinco Hyper-G" })]);
    const res = await post({ ...base, mainsItemId: SET, mainsLengthM: 6, crossesCustomName: "Natural gut" });
    expect(res.status).toBe(201);
    expect(res.body.data.mainsSource).toBe("set");
    const data = updateFor(SET);
    expect(data.stringRemainingM).toBe(0);
    expect(data.usedUpAt).toBeInstanceOf(Date);
  });

  it("does not need a length for a set", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ id: SET, stringForm: "set", stringLengthM: 12, stringRemainingM: 12 })]);
    const res = await post({ ...base, mainsItemId: SET });
    expect(res.status).toBe(201);
  });
});

describe("POST — refusals", () => {
  it("400s a string that belongs to someone else", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ playerId: "someone-else" })]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 12 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not in this player's bag/);
    expect(db.stringSetup.create).not.toHaveBeenCalled();
  });

  it("400s an item that is not a string", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ category: "racket", name: "Pure Drive" })]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 12 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a string/);
  });

  it("400s a used-up item", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ usedUpAt: new Date("2026-05-01") })]);
    const res = await post({ ...base, mainsItemId: REEL, mainsLengthM: 12 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already used up/);
  });

  it("links a legacy string row (no form) without touching it", async () => {
    db.equipmentItem.findMany.mockResolvedValue([bag({ stringForm: null, stringLengthM: null, stringRemainingM: null })]);
    const res = await post({ ...base, mainsItemId: REEL });
    expect(res.status).toBe(201);
    expect(db.equipmentItem.update).not.toHaveBeenCalled();
  });
});

describe("PATCH — what was drawn is fixed", () => {
  it("400s a length change on a side that drew from the bag", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER, mainsItemId: REEL, crossesItemId: null, mainsLengthM: 12, crossesLengthM: null });
    const res = await request(app).patch("/api/string-setups/ss-1").set("Authorization", bearer(PLAYER)).send({ mainsLengthM: 10 });
    expect(res.status).toBe(400);
    expect(db.stringSetup.update).not.toHaveBeenCalled();
  });

  it("still allows retiring a job that drew from the bag", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER, mainsItemId: REEL, crossesItemId: null, mainsLengthM: 12, crossesLengthM: null });
    db.stringSetup.update.mockResolvedValue(created({ ...base, retiredAt: new Date("2026-07-01"), retiredReason: "broke" }));
    const res = await request(app)
      .patch("/api/string-setups/ss-1")
      .set("Authorization", bearer(PLAYER))
      .send({ retiredAt: "2026-07-01", retiredReason: "broke" });
    expect(res.status).toBe(200);
  });
});

describe("DELETE — the metres go back", () => {
  it("adds the metres back on a reel and clears used-up", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER, mainsItemId: REEL, crossesItemId: null, mainsLengthM: 12, crossesLengthM: null });
    db.equipmentItem.findMany.mockResolvedValue([bag({ stringRemainingM: 0, usedUpAt: new Date("2026-06-01") })]);
    db.stringSetup.delete.mockResolvedValue({});
    const res = await request(app).delete("/api/string-setups/ss-1").set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(updateFor(REEL)).toEqual({ stringRemainingM: 12, usedUpAt: null });
  });

  it("restores a set to full", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER, mainsItemId: SET, crossesItemId: null, mainsLengthM: null, crossesLengthM: null });
    db.equipmentItem.findMany.mockResolvedValue([bag({ id: SET, stringForm: "set", stringLengthM: 12, stringRemainingM: 0, usedUpAt: new Date("2026-06-01") })]);
    db.stringSetup.delete.mockResolvedValue({});
    const res = await request(app).delete("/api/string-setups/ss-1").set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(updateFor(SET)).toEqual({ stringRemainingM: 12, usedUpAt: null });
  });

  it("never exceeds the reel's total when restoring", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER, mainsItemId: REEL, crossesItemId: null, mainsLengthM: 12, crossesLengthM: null });
    db.equipmentItem.findMany.mockResolvedValue([bag({ stringRemainingM: 195 })]);
    db.stringSetup.delete.mockResolvedValue({});
    await request(app).delete("/api/string-setups/ss-1").set("Authorization", bearer(PLAYER));
    expect(updateFor(REEL).stringRemainingM).toBe(200);
  });

  it("deletes cleanly when the item it drew from is gone", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER, mainsItemId: REEL, crossesItemId: null, mainsLengthM: 12, crossesLengthM: null });
    db.equipmentItem.findMany.mockResolvedValue([]);
    db.stringSetup.delete.mockResolvedValue({});
    const res = await request(app).delete("/api/string-setups/ss-1").set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);
    expect(db.equipmentItem.update).not.toHaveBeenCalled();
  });
});
