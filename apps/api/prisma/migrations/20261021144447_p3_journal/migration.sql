-- AlterTable
ALTER TABLE "WearLog" ADD COLUMN     "photoDisplayPath" TEXT,
ADD COLUMN     "photoOriginalPath" TEXT,
ADD COLUMN     "photoThumbnailPath" TEXT,
ADD COLUMN     "photoUpdatedAt" TIMESTAMP(3);
