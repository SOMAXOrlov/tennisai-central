import { Router } from "express";
import { z } from "zod";
import type { ConnectionRequest, User } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";

export const connectionsRouter = Router();
connectionsRouter.use(requireAuth);

const sendSchema = z.object({
  toUserId: z.string().min(1),
  toPublicId: z.string().optional(), // accepted; the server resolves by id
});

const updateSchema = z.object({ status: z.enum(["active", "rejected"]) });

type ConnWithUsers = ConnectionRequest & { fromUser: User; toUser: User };

/** Map a row to the denormalised front-end `ConnectionRequest` shape. */
function present(r: ConnWithUsers) {
  return {
    id: r.id,
    fromUserId: r.fromUserId,
    fromUserName: `${r.fromUser.firstName} ${r.fromUser.lastName}`,
    fromUserRole: r.fromUser.role,
    toUserId: r.toUserId,
    toUserName: `${r.toUser.firstName} ${r.toUser.lastName}`,
    toUserRole: r.toUser.role,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const withUsers = { fromUser: true, toUser: true } as const;

// GET /api/connections — every request involving the current user.
connectionsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.connectionRequest.findMany({
      where: { OR: [{ fromUserId: req.userId! }, { toUserId: req.userId! }] },
      include: withUsers,
      orderBy: { updatedAt: "desc" },
    });
    return ok(res, rows.map(present));
  }),
);

// POST /api/connections — send a new request from the current user.
connectionsRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { toUserId } = sendSchema.parse(req.body);
    const fromUserId = req.userId!;

    if (toUserId === fromUserId) throw new HttpError(400, "You cannot connect with yourself.");

    const target = await prisma.user.findUnique({ where: { id: toUserId } });
    if (!target) throw new HttpError(404, "User not found");

    // Block if an active or pending relationship exists in EITHER direction.
    const blocking = await prisma.connectionRequest.findFirst({
      where: {
        status: { in: ["active", "pending"] },
        OR: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      },
    });
    if (blocking) {
      throw new HttpError(
        409,
        blocking.status === "active"
          ? "You're already connected with this user."
          : "A pending request already exists between you.",
      );
    }

    // Reuse a stale (rejected/revoked) row in the same direction if present,
    // otherwise create — respects the @@unique([fromUserId, toUserId]).
    const created = await prisma.connectionRequest.upsert({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
      update: { status: "pending" },
      create: { fromUserId, toUserId, status: "pending" },
      include: withUsers,
    });
    return ok(res, present(created), "Connection request sent", 201);
  }),
);

// PATCH /api/connections/:id — recipient approves or rejects a pending request.
connectionsRouter.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { status } = updateSchema.parse(req.body);
    const existing = await prisma.connectionRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Request not found.");
    if (existing.toUserId !== req.userId) {
      throw new HttpError(403, "Only the recipient can act on this request.");
    }
    if (existing.status !== "pending") {
      throw new HttpError(409, `Request is already ${existing.status}.`);
    }
    const updated = await prisma.connectionRequest.update({
      where: { id: req.params.id },
      data: { status },
      include: withUsers,
    });
    return ok(res, present(updated), status === "active" ? "Connection approved" : "Request rejected");
  }),
);

// DELETE /api/connections/:id — revoke an active relationship (either party).
connectionsRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.connectionRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Relationship not found.");
    if (existing.status !== "active") throw new HttpError(409, "Only active relationships can be revoked.");
    if (existing.fromUserId !== req.userId && existing.toUserId !== req.userId) {
      throw new HttpError(403, "You are not part of this relationship.");
    }
    await prisma.connectionRequest.update({
      where: { id: req.params.id },
      data: { status: "revoked" },
    });
    return ok(res, null, "Relationship revoked");
  }),
);
