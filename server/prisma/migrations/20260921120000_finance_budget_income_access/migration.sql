-- The finance ledger grows a second side and two companions.
--
-- finance_entries.kind: "expense" | "income". Every row already written was an
-- expense (the ledger had no other side), so the default backfills them truthfully
-- and no UPDATE runs. createdById / updatedById record who wrote or last changed a
-- row now that a parent with an access grant can do so; nullable because older
-- rows have no author on record, SET NULL because deleting a parent account must
-- not delete the family ledger. updatedAt defaults to now() so the ALTER is safe
-- on a table with rows.
--
-- finance_budgets: one season plan per player per season label, in ONE currency,
-- lines as JSON {category: planned}. Actuals are compared only with expenses in
-- that currency; nothing is ever converted.
--
-- finance_access_grants: what the player has let one other person do
-- (view | add | full). Granted by the player, revocable, one row per pair.

-- AlterTable
ALTER TABLE "finance_entries" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'expense',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "finance_budgets" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "seasonStart" TEXT NOT NULL,
    "seasonEnd" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "lines" JSONB NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_access_grants" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_budgets_playerId_season_key" ON "finance_budgets"("playerId", "season");

-- CreateIndex
CREATE INDEX "finance_access_grants_granteeId_idx" ON "finance_access_grants"("granteeId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_access_grants_playerId_granteeId_key" ON "finance_access_grants"("playerId", "granteeId");

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_access_grants" ADD CONSTRAINT "finance_access_grants_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_access_grants" ADD CONSTRAINT "finance_access_grants_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

