-- AlterTable
ALTER TABLE "equipment_items" ADD COLUMN     "stringForm" TEXT,
ADD COLUMN     "stringLengthM" DOUBLE PRECISION,
ADD COLUMN     "stringRemainingM" DOUBLE PRECISION,
ADD COLUMN     "usedUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "string_setups" ADD COLUMN     "crossesItemId" TEXT,
ADD COLUMN     "mainsItemId" TEXT;

-- AddForeignKey
ALTER TABLE "string_setups" ADD CONSTRAINT "string_setups_mainsItemId_fkey" FOREIGN KEY ("mainsItemId") REFERENCES "equipment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "string_setups" ADD CONSTRAINT "string_setups_crossesItemId_fkey" FOREIGN KEY ("crossesItemId") REFERENCES "equipment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

