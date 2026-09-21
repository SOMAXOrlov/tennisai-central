// ============================================================================
// String setups — how much string went in, and where it came from.
//
// Metres per job, mains and crosses separately for a hybrid, source `set`
// (pre-cut) or `reel`. The bounds only refuse nonsense; the API stores what
// the stringer says.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { stringSetupsRouter } from "../stringSetups/routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", stringSetupsRouter]]);

const PLAYER = "player-1";

const base = { racketItemId: "eq-1", tensionMainsKg: 23, strungAt: "2026-06-01" };

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

beforeEach(() => {
  vi.resetAllMocks();
  // Creating and deleting a job runs inside a transaction; hand the callback
  // the same mock so every existing assertion on the delegates still holds.
  db.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db));
  db.equipmentItem.findUnique.mockResolvedValue({ playerId: PLAYER });
  db.stringSetup.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => created(data));
});

describe("POST /api/players/:playerId/string-setups — length and source", () => {
  it("stores metres and source for mains and crosses and presents them back", async () => {
    const res = await request(app)
      .post(`/api/players/${PLAYER}/string-setups`)
      .set("Authorization", bearer(PLAYER))
      .send({ ...base, mainsLengthM: 6, crossesLengthM: 6, mainsSource: "set", crossesSource: "reel", crossesCustomName: "Gut" });
    expect(res.status).toBe(201);
    const data = firstCallArg<{ data: Record<string, unknown> }>(db.stringSetup.create).data;
    expect(data).toMatchObject({ mainsLengthM: 6, crossesLengthM: 6, mainsSource: "set", crossesSource: "reel" });
    expect(res.body.data).toMatchObject({ mainsLengthM: 6, crossesLengthM: 6, mainsSource: "set", crossesSource: "reel" });
  });

  it("leaves the fields out of the response when they were not recorded", async () => {
    const res = await request(app).post(`/api/players/${PLAYER}/string-setups`).set("Authorization", bearer(PLAYER)).send(base);
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty("mainsLengthM");
    expect(res.body.data).not.toHaveProperty("mainsSource");
  });

  it("refuses a reel length typed as a job length, a gauge typed as a length, and an unknown source", async () => {
    for (const body of [
      { ...base, mainsLengthM: 200 },
      { ...base, mainsLengthM: 0.5 },
      { ...base, mainsSource: "bag" },
    ]) {
      const res = await request(app).post(`/api/players/${PLAYER}/string-setups`).set("Authorization", bearer(PLAYER)).send(body);
      expect(res.status).toBe(400);
    }
    expect(db.stringSetup.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/string-setups/:id — length and source", () => {
  it("accepts the same fields on an update", async () => {
    db.stringSetup.findUnique.mockResolvedValue({ playerId: PLAYER });
    db.stringSetup.update.mockResolvedValue(created({ ...base, mainsLengthM: 12, mainsSource: "reel" }));
    const res = await request(app).patch(`/api/string-setups/ss-1`).set("Authorization", bearer(PLAYER)).send({ mainsLengthM: 12, mainsSource: "reel" });
    expect(res.status).toBe(200);
    expect(firstCallArg<{ data: Record<string, unknown> }>(db.stringSetup.update).data).toEqual({ mainsLengthM: 12, mainsSource: "reel" });
    expect(res.body.data).toMatchObject({ mainsLengthM: 12, mainsSource: "reel" });
  });
});
