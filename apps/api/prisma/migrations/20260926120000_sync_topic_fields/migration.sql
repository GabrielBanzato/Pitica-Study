-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "academicSummary" TEXT,
ADD COLUMN     "academicText" TEXT,
ADD COLUMN     "fashionSummary" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
