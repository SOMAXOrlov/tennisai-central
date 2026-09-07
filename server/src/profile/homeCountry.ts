// Where a player competes — read and write, plus the list of countries a
// client may offer.
//
// Mounted at /api, so the paths are written out in full:
//
//   GET  /api/countries                        the codes this server accepts
//   GET  /api/players/:playerId/home-country   read one player's
//   PUT  /api/players/:playerId/home-country   set or clear one player's
//
// AUTHORIZATION
// Both player routes go through `assertCanActOnPlayer` for anyone who is not
// the player themselves — the same check that decides whether a coach may enter
// that player for a tournament. A coach setting up their squad's calendar is
// exactly the case this has to serve, and a stranger must not be able to read
// where a junior lives, so nothing here is looser than the entry route it feeds.
//
// WHY THE COUNTRY LIST COMES FROM THE SERVER
// The codes the picker offers and the codes the PUT accepts have to be the same
// set, or a player picks a country and the save fails. One list, served from the
// side that validates — not a second copy in the browser that can drift.

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, type AuthedRequest } from "../http";
import { assertCanActOnPlayer } from "../authz";
import { allCountries, countryNameFor, normaliseCountryCode } from "../lib/countries";

// Every route carries `requireAuth` itself rather than the router carrying it,
// because this router is mounted at "/api": a router-level guard there runs for
// every /api request that reaches it and would 401 sibling paths before their
// own auth check ran. stringSetupsRouter and recommendRouter are mounted the
// same way for the same reason.
export const homeCountryRouter = Router();

/**
 * `null` clears it, which is a real choice — a player who moves and does not
 * yet know where they will compete should be able to say so, and the page then
 * reports that it cannot scope itself rather than keeping a stale country.
 */
const homeCountrySchema = z.object({
  homeCountry: z
    .string()
    .trim()
    .refine((v) => normaliseCountryCode(v) !== null, {
      message: "homeCountry must be an ISO 3166-1 alpha-2 country code, e.g. US",
    })
    .nullable(),
});

/** GET /api/countries — every code this server will accept, with its name. */
homeCountryRouter.get(
  "/countries",
  requireAuth,
  asyncHandler(async (_req, res) => {
    return ok(res, allCountries());
  }),
);

/** The shape both player routes answer with. */
function present(code: string | null) {
  return { homeCountry: code, homeCountryName: countryNameFor(code) };
}

// GET /api/players/:playerId/home-country
homeCountryRouter.get(
  "/players/:playerId/home-country",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { playerId } = req.params;
    if (playerId !== req.userId) await assertCanActOnPlayer(req.userId!, playerId);

    const profile = await prisma.playerProfile.findUnique({
      where: { userId: playerId },
      select: { homeCountry: true },
    });
    // No profile row yet is the normal state for a new account, not a 404: it
    // means "not set", which is exactly what the caller needs to hear.
    return ok(res, present(profile?.homeCountry ?? null));
  }),
);

// PUT /api/players/:playerId/home-country
homeCountryRouter.put(
  "/players/:playerId/home-country",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { playerId } = req.params;
    if (playerId !== req.userId) await assertCanActOnPlayer(req.userId!, playerId);

    const { homeCountry } = homeCountrySchema.parse(req.body);
    // Stored upper case whatever the client sent, so "us" and "US" are one
    // country and the country facet cannot split in two.
    const code = homeCountry === null ? null : normaliseCountryCode(homeCountry);

    const row = await prisma.playerProfile.upsert({
      where: { userId: playerId },
      create: { userId: playerId, homeCountry: code },
      update: { homeCountry: code },
      select: { homeCountry: true },
    });

    return ok(res, present(row.homeCountry), "Home country saved");
  }),
);
