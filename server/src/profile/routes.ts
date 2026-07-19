import { Router } from "express";
import { z } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";

// Mounted at /api/me.
export const profileRouter = Router();
profileRouter.use(requireAuth);

const updateSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
  })
  .partial();

function publicUser(u: User) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// GET /api/me/profile
profileRouter.get(
  "/profile",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new HttpError(404, "User not found");
    return ok(res, publicUser(user));
  }),
);

// PATCH /api/me/profile
profileRouter.patch(
  "/profile",
  asyncHandler(async (req: AuthedRequest, res) => {
    const d = updateSchema.parse(req.body);
    const email = d.email ? d.email.trim().toLowerCase() : undefined;
    // Prisma raises P2002 on a duplicate email → the error handler maps it to 409.
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { firstName: d.firstName, lastName: d.lastName, email },
    });
    return ok(res, publicUser(user), "Profile updated");
  }),
);
