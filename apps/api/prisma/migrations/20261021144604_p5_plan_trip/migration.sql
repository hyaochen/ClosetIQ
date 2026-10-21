-- CreateTable
CREATE TABLE "PlannedOutfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "outfitId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedOutfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedOutfitItem" (
    "id" TEXT NOT NULL,
    "plannedOutfitId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,

    CONSTRAINT "PlannedOutfitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "clothingItemId" TEXT,
    "customName" TEXT,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TripItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedOutfit_userId_date_idx" ON "PlannedOutfit"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedOutfit_userId_date_key" ON "PlannedOutfit"("userId", "date");

-- CreateIndex
CREATE INDEX "PlannedOutfitItem_plannedOutfitId_idx" ON "PlannedOutfitItem"("plannedOutfitId");

-- CreateIndex
CREATE INDEX "PlannedOutfitItem_clothingItemId_idx" ON "PlannedOutfitItem"("clothingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedOutfitItem_plannedOutfitId_clothingItemId_key" ON "PlannedOutfitItem"("plannedOutfitId", "clothingItemId");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "Trip_userId_startDate_idx" ON "Trip"("userId", "startDate");

-- CreateIndex
CREATE INDEX "TripItem_tripId_idx" ON "TripItem"("tripId");

-- CreateIndex
CREATE INDEX "TripItem_clothingItemId_idx" ON "TripItem"("clothingItemId");

-- AddForeignKey
ALTER TABLE "PlannedOutfit" ADD CONSTRAINT "PlannedOutfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOutfit" ADD CONSTRAINT "PlannedOutfit_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOutfitItem" ADD CONSTRAINT "PlannedOutfitItem_plannedOutfitId_fkey" FOREIGN KEY ("plannedOutfitId") REFERENCES "PlannedOutfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOutfitItem" ADD CONSTRAINT "PlannedOutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
