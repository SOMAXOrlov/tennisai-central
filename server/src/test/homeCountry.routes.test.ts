// ============================================================================
// Where a player competes — /api/countries and /api/players/:id/home-country.
//
// This is the field the tournaments page scopes itself by, so two things have
// to hold: a coach may set it for a player they may act on and nobody else can
// read or write it, and the code that goes in is a real country code rather than
// whatever the client typed. Both are asserted against what the ROUTE did — the
// refusal, and the arguments handed to Prisma.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { homeCountryRouter } from "../profile/homeCountry";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", homeCountryRouter]]);

const COACH = "user-coach";
const PLAYER = "user-player";
const STRANGER = "user-stranger";

/** No relationship of any kind — every rung of assertCanActOnPlayer refuses. */
function unrelated() {
  db.coachAssignment.findUnique.mockResolvedValue(null);
  db.connectionRequest.findFirst.mockResolvedValue(null);
  db.guardianship.findUnique.mockResolvedValue(null);
}

/** An active coach assignment, the first rung. */
function assigned() {
  db.coachAssignment.findUnique.mockResolvedValue({ status: "active" });
}

beforeEach(() => {
  vi.resetAllMocks();
  db.playerProfile.findUnique.mockResolvedValue(null);
  db.playerProfile.upsert.mockResolvedValue({ homeCountry: "US" });
});

describe("GET /api/countries", () => {
  it("offers the codes the save route accepts, with their names", async () => {
    const res = await request(app).get("/api/countries").set("Authorization", bearer(PLAYER));
    expect(res.status).toBe(200);

    const codes: string[] = res.body.data.map((c: { code: string }) => c.code);
    expect(codes).toContain("US");
    expect(codes).toContain("ES");
    expect(res.body.data.find((c: { code: string }) => c.code === "US").name).toBe("United States");
    // Groupings are not places a player lives.
    expect(codes).not.toContain("EU");
  });

  it("is sorted by name, so a picker does not have to sort it again", async () => {
    const res = await request(app).get("/api/countries").set("Authorization", bearer(PLAYER));
    const names: string[] = res.body.data.map((c: { name: string }) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("401s an anonymous caller", async () => {
    expect((await request(app).get("/api/countries")).status).toBe(401);
  });
});

describe("GET /api/players/:playerId/home-country", () => {
  it("reads the player's own", async () => {
    db.playerProfile.findUnique.mockResolvedValue({ homeCountry: "US" });

    const res = await request(app)
      .get(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(PLAYER));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ homeCountry: "US", homeCountryName: "United States" });
    expect(firstCallArg(db.playerProfile.findUnique)).toMatchObject({
      where: { userId: PLAYER },
    });
  });

  it("answers 'not set' rather than 404 when the player has no profile row yet", async () => {
    // The normal state of a new account. A 404 here would make the page show an
    // error where the honest answer is "nobody has said yet".
    const res = await request(app)
      .get(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(PLAYER));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ homeCountry: null, homeCountryName: null });
  });

  it("lets an assigned coach read their player's", async () => {
    assigned();
    db.playerProfile.findUnique.mockResolvedValue({ homeCountry: "ES" });

    const res = await request(app)
      .get(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(COACH));

    expect(res.status).toBe(200);
    expect(res.body.data.homeCountryName).toBe("Spain");
  });

  it("403s a stranger and never reads the profile", async () => {
    unrelated();

    const res = await request(app)
      .get(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(STRANGER));

    expect(res.status).toBe(403);
    expect(db.playerProfile.findUnique).not.toHaveBeenCalled();
  });
});

describe("PUT /api/players/:playerId/home-country", () => {
  it("saves the player's own choice, upper-cased", async () => {
    // "us" and "US" must not become two countries, or the country facet splits.
    const res = await request(app)
      .put(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(PLAYER))
      .send({ homeCountry: "us" });

    expect(res.status).toBe(200);
    expect(firstCallArg(db.playerProfile.upsert)).toMatchObject({
      where: { userId: PLAYER },
      create: { userId: PLAYER, homeCountry: "US" },
      update: { homeCountry: "US" },
    });
  });

  it("lets an assigned coach set it for their player", async () => {
    // Setting up a squad's calendar is the case this exists for.
    assigned();
    db.playerProfile.upsert.mockResolvedValue({ homeCountry: "US" });

    const res = await request(app)
      .put(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(COACH))
      .send({ homeCountry: "US" });

    expect(res.status).toBe(200);
    expect(firstCallArg(db.playerProfile.upsert)).toMatchObject({
      where: { userId: PLAYER },
    });
  });

  it("403s a stranger and writes nothing", async () => {
    unrelated();

    const res = await request(app)
      .put(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(STRANGER))
      .send({ homeCountry: "US" });

    expect(res.status).toBe(403);
    expect(db.playerProfile.upsert).not.toHaveBeenCalled();
  });

  it("refuses anything that is not a country code", async () => {
    for (const value of ["USA", "United States", "ZZ", "u", ""]) {
      const res = await request(app)
        .put(`/api/players/${PLAYER}/home-country`)
        .set("Authorization", bearer(PLAYER))
        .send({ homeCountry: value });
      expect(res.status, `value ${JSON.stringify(value)}`).toBe(400);
    }
    expect(db.playerProfile.upsert).not.toHaveBeenCalled();
  });

  it("accepts null as clearing it, which is a real answer", async () => {
    // A player between countries should be able to say they do not know, and
    // the page then reports it cannot scope itself instead of holding a stale
    // country for them.
    db.playerProfile.upsert.mockResolvedValue({ homeCountry: null });

    const res = await request(app)
      .put(`/api/players/${PLAYER}/home-country`)
      .set("Authorization", bearer(PLAYER))
      .send({ homeCountry: null });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ homeCountry: null, homeCountryName: null });
    expect(firstCallArg(db.playerProfile.upsert)).toMatchObject({
      update: { homeCountry: null },
    });
  });

  it("401s an anonymous caller and writes nothing", async () => {
    const res = await request(app)
      .put(`/api/players/${PLAYER}/home-country`)
      .send({ homeCountry: "US" });
    expect(res.status).toBe(401);
    expect(db.playerProfile.upsert).not.toHaveBeenCalled();
  });
});
