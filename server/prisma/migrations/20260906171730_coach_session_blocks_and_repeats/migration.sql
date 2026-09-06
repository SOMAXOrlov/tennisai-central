-- Coach-authored session content, weekly repeats, and a real team relation.
--
-- Every column added here is nullable or defaulted, so this applies to a
-- database with rows in it without rewriting any of them.

-- AlterTable
ALTER TABLE "trainings" ADD COLUMN     "recurrence" JSONB,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'scheduled';

-- Hand-added, and the one statement in this migration that CHANGES existing
-- data. Until now `trainings.teamId` was a bare string with no foreign key and
-- no existence check on the way in, so a live database can hold pointers to
-- teams that were deleted years ago. Adding the FK below would fail outright on
-- the first such row and take the whole deploy with it.
--
-- Nulling them is the honest repair: the team it named is already gone, the
-- pointer already resolved to nothing everywhere it was read, and the session's
-- real roster is its participant rows, which this does not touch. A session
-- loses a label that had stopped meaning anything; it loses no players.
UPDATE "trainings" SET "teamId" = NULL
WHERE "teamId" IS NOT NULL
  AND "teamId" NOT IN (SELECT "id" FROM "teams");

-- CreateTable
CREATE TABLE "training_blocks" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coachNotes" TEXT,
    "minutes" INTEGER,
    "libraryDrillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_blocks_trainingId_idx" ON "training_blocks"("trainingId");

-- CreateIndex
CREATE INDEX "training_blocks_libraryDrillId_idx" ON "training_blocks"("libraryDrillId");

-- CreateIndex
CREATE UNIQUE INDEX "training_blocks_trainingId_order_key" ON "training_blocks"("trainingId", "order");

-- CreateIndex
CREATE INDEX "trainings_seriesId_idx" ON "trainings"("seriesId");

-- CreateIndex
CREATE INDEX "trainings_teamId_idx" ON "trainings"("teamId");

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_libraryDrillId_fkey" FOREIGN KEY ("libraryDrillId") REFERENCES "drills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
