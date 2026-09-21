// ============================================================================
// HTTP route tests — /api/notifications: what a user may do with one.
//
// Read, archive, restore and delete are the user's own to perform on their
// own rows only. Archiving takes a notification out of the inbox and the
// unread count; deleting removes it. "Mark all read" leaves archived rows as
// they are.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../db", async () => ({ prisma: (await import("./harness")).createPrismaMock() }));

import { prisma } from "../db";
import { notificationsRouter } from "../notifications/routes";
import { bearer, createTestApp, firstCallArg, prismaMockFrom } from "./harness";

const db = prismaMockFrom(prisma);
const app = createTestApp([["/api", notificationsRouter]]);

const ME = "user-me";
const OTHER = "user-other";
const ARCHIVED_AT = new Date("2026-09-20T10:00:00.000Z");

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "n-1",
    userId: ME,
    type: "training_created",
    title: "New training scheduled",
    message: "Coach scheduled \"Serve\" for Mon 8 Jun, 09:00.",
    read: false,
    linkTo: "/calendar?date=2026-06-08&event=training-t1-user-me",
    createdAt: new Date("2026-09-21T08:00:00.000Z"),
    emailedAt: null,
    archivedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/notifications", () => {
  it("presents archivedAt as an ISO string, and leaves it out when the row is in the inbox", async () => {
    db.notification.findMany.mockResolvedValue([row(), row({ id: "n-2", archivedAt: ARCHIVED_AT, read: true })]);
    const res = await request(app).get("/api/notifications").set("Authorization", bearer(ME));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty("archivedAt");
    expect(res.body.data[1].archivedAt).toBe(ARCHIVED_AT.toISOString());
    expect(res.body.data[0].linkTo).toBe("/calendar?date=2026-06-08&event=training-t1-user-me");
  });
});

describe("PATCH /api/notifications/read-all", () => {
  it("marks the inbox read and leaves archived rows alone", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 3 });
    const res = await request(app).patch("/api/notifications/read-all").set("Authorization", bearer(ME));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.notification.updateMany)).toEqual({
      where: { userId: ME, archivedAt: null },
      data: { read: true },
    });
  });
});

describe("PATCH /api/notifications/:id/archive", () => {
  it("404s when the notification does not exist", async () => {
    db.notification.findUnique.mockResolvedValue(null);
    const res = await request(app).patch("/api/notifications/n-9/archive").set("Authorization", bearer(ME));
    expect(res.status).toBe(404);
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it("403s on somebody else's notification", async () => {
    db.notification.findUnique.mockResolvedValue(row({ userId: OTHER }));
    const res = await request(app).patch("/api/notifications/n-1/archive").set("Authorization", bearer(ME));
    expect(res.status).toBe(403);
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it("stamps archivedAt, marks it read and returns the row", async () => {
    db.notification.findUnique.mockResolvedValue(row());
    db.notification.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row({ ...data }));
    const res = await request(app).patch("/api/notifications/n-1/archive").set("Authorization", bearer(ME));
    expect(res.status).toBe(200);
    const arg = firstCallArg<{ where: { id: string }; data: { archivedAt: Date; read: boolean } }>(db.notification.update);
    expect(arg.where).toEqual({ id: "n-1" });
    expect(arg.data.read).toBe(true);
    expect(arg.data.archivedAt).toBeInstanceOf(Date);
    expect(typeof res.body.data.archivedAt).toBe("string");
    expect(res.body.data.read).toBe(true);
  });
});

describe("PATCH /api/notifications/:id/unarchive", () => {
  it("clears archivedAt and keeps everything else", async () => {
    db.notification.findUnique.mockResolvedValue(row({ archivedAt: ARCHIVED_AT, read: true }));
    db.notification.update.mockResolvedValue(row({ read: true }));
    const res = await request(app).patch("/api/notifications/n-1/unarchive").set("Authorization", bearer(ME));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.notification.update)).toEqual({ where: { id: "n-1" }, data: { archivedAt: null } });
    expect(res.body.data).not.toHaveProperty("archivedAt");
    expect(res.body.data.read).toBe(true);
  });

  it("403s on somebody else's notification", async () => {
    db.notification.findUnique.mockResolvedValue(row({ userId: OTHER, archivedAt: ARCHIVED_AT }));
    const res = await request(app).patch("/api/notifications/n-1/unarchive").set("Authorization", bearer(ME));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/notifications/:id", () => {
  it("deletes the caller's own notification", async () => {
    db.notification.findUnique.mockResolvedValue(row());
    db.notification.delete.mockResolvedValue(row());
    const res = await request(app).delete("/api/notifications/n-1").set("Authorization", bearer(ME));
    expect(res.status).toBe(200);
    expect(firstCallArg(db.notification.delete)).toEqual({ where: { id: "n-1" } });
  });

  it("refuses to delete somebody else's, without touching it", async () => {
    db.notification.findUnique.mockResolvedValue(row({ userId: OTHER }));
    const res = await request(app).delete("/api/notifications/n-1").set("Authorization", bearer(ME));
    expect(res.status).toBe(403);
    expect(db.notification.delete).not.toHaveBeenCalled();
  });

  it("needs a session", async () => {
    const res = await request(app).delete("/api/notifications/n-1");
    expect(res.status).toBe(401);
  });
});
