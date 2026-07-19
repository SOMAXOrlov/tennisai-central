import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok } from "../http";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// GET /api/users/directory — discoverable users for the connection lookup.
// Returns the public-safe DirectoryEntry shape (no email / hash).
usersRouter.get(
  "/directory",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { role: { not: "admin" } },
      select: { id: true, publicId: true, firstName: true, lastName: true, role: true },
      orderBy: { firstName: "asc" },
    });
    return ok(res, users);
  }),
);
