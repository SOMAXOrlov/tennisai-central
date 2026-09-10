-- A match may now say which racket it was played with.
--
-- `racketItemId` points at the player's OWN equipment row, not a catalogue
-- product: two identical frames strung differently are two different rackets
-- to a player. The column is nullable and there is no backfill — every match
-- logged before today simply has no racket recorded, and the statistics say
-- so rather than guessing.
--
-- ON DELETE SET NULL: throwing a broken frame out of the bag must never delete
-- the matches that were played with it. The match keeps its counts and only
-- loses the racket tag.

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "racketItemId" TEXT;

-- CreateIndex
CREATE INDEX "matches_racketItemId_idx" ON "matches"("racketItemId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_racketItemId_fkey" FOREIGN KEY ("racketItemId") REFERENCES "equipment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
