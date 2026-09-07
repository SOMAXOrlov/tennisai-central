-- Where a player competes, as an ISO 3166-1 alpha-2 code ("US", "ES").
-- Additive and nullable: every existing profile keeps working and simply has no
-- home country, which the tournaments page reports rather than guessing at.
-- AlterTable
ALTER TABLE "player_profiles" ADD COLUMN     "homeCountry" TEXT;

-- The tournaments list is now filtered by country on the server (and the page's
-- default scope IS a country), so this is the shape of almost every query the
-- table gets. Index-only, no data touched.
-- CreateIndex
CREATE INDEX "tournaments_country_startDate_idx" ON "tournaments"("country", "startDate");
