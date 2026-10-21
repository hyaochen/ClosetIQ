-- AlterTable
ALTER TABLE "ClothingItem" ADD COLUMN     "laundryStatus" TEXT NOT NULL DEFAULT 'CLEAN',
ADD COLUMN     "storageLocationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoDirtyOnWear" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "currentSeason" TEXT;

-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOffSeason" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageLocation_userId_idx" ON "StorageLocation"("userId");

-- CreateIndex
CREATE INDEX "ClothingItem_userId_laundryStatus_idx" ON "ClothingItem"("userId", "laundryStatus");

-- CreateIndex
CREATE INDEX "ClothingItem_storageLocationId_idx" ON "ClothingItem"("storageLocationId");

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClothingItem" ADD CONSTRAINT "ClothingItem_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
