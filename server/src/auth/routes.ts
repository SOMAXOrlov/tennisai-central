import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "../db";
import { signToken } from "./jwt";
import { sendWelcomeEmail } from "../email/mailer";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";

export const authRouter = Router();

const BCRYPT_COST = 12;

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["player", "coach", "observer", "admin"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Strip the password hash before sending a user to the client. */
function publicUser(u: User) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// POST /api/auth/signup — create account, then send a welcome email.
authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const data = signupSchema.parse(req.body);
    const email = data.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "Email already registered");

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    // Fire-and-forget: a failed/queued email must never block account creation.
    void sendWelcomeEmail(email, user.firstName, user.role);

    return ok(res, { user: publicUser(user) }, "Account created! A welcome email is on its way.", 201);
  }),
);

// POST /api/auth/login — verify credentials, issue a JWT.
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    // Uniform error — never reveal whether it was the email or the password.
    if (!parsed.success) throw new HttpError(401, "Invalid email or password");

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }

    const accessToken = signToken(user.id);
    return ok(res, { user: publicUser(user), tokens: { accessToken, refreshToken: accessToken } });
  }),
);

// POST /api/auth/logout — stateless JWT, nothing to invalidate server-side.
authRouter.post("/logout", (_req, res) => {
  return ok(res, null);
});

// GET /api/auth/me — resolve the current user from the Bearer token.
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new HttpError(401, "Not authenticated");
    return ok(res, publicUser(user));
  }),
);
