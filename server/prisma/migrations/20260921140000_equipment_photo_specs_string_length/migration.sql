-- AlterTable
ALTER TABLE "equipment_items" ADD COLUMN     "photoId" TEXT,
ADD COLUMN     "photoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "specs" JSONB;

-- AlterTable
ALTER TABLE "string_setups" ADD COLUMN     "crossesLengthM" DOUBLE PRECISION,
ADD COLUMN     "crossesSource" TEXT,
ADD COLUMN     "mainsLengthM" DOUBLE PRECISION,
ADD COLUMN     "mainsSource" TEXT;

