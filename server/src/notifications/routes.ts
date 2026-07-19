import { Router } from "express";
import { z } from "zod";
import type { Notification, NotificationPreference } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";

// Mounted at /api.
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

function present(n: Notification) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    linkTo: n.linkTo ?? undefined,
    createdAt: n.createdAt.toISOString(),
  };
}

function presentPrefs(p: NotificationPreference) {
  return {
    trainingReminders: p.trainingReminders,
    tournamentReminders: p.tournamentReminders,
    requestApprovals: p.requestApprovals,
    financeUpdates: p.financeUpdates,
    aiInsightUpdates: p.aiInsightUpdates,
    systemNotifications: p.systemNotifications,
  };
}

const prefsSchema = z
  .object({
    trainingReminders: z.boolean(),
    tournamentReminders: z.boolean(),
    requestApprovals: z.boolean(),
    financeUpdates: z.boolean(),
    aiInsightUpdates: z.boolean(),
    systemNotifications: z.boolean(),
  })
  .partial();

/** Fire-and-forget notification creation, reused by other domains. */
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  message: string;
  linkTo?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({ data: { ...input, read: false } });
  } catch {
    /* a failed notification must never break the triggering action */
  }
}

notificationsRouter.get(
  "/notifications",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, rows.map(present));
  }),
);

notificationsRouter.patch(
  "/notifications/read-all",
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.notification.updateMany({ where: { userId: req.userId! }, data: { read: true } });
    return ok(res, null);
  }),
);

notificationsRouter.patch(
  "/notifications/:id/read",
  asyncHandler(async (req: AuthedRequest, res) => {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n) throw new HttpError(404, "Notification not found");
    if (n.userId !== req.userId) throw new HttpError(403, "Not your notification");
    await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    return ok(res, null);
  }),
);

notificationsRouter.get(
  "/notification-preferences",
  asyncHandler(async (req: AuthedRequest, res) => {
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.userId! },
      update: {},
      create: { userId: req.userId! },
    });
    return ok(res, presentPrefs(prefs));
  }),
);

notificationsRouter.patch(
  "/notification-preferences",
  asyncHandler(async (req: AuthedRequest, res) => {
    const d = prefsSchema.parse(req.body);
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.userId! },
      update: d,
      create: { userId: req.userId!, ...d },
    });
    return ok(res, presentPrefs(prefs), "Preferences updated");
  }),
);
