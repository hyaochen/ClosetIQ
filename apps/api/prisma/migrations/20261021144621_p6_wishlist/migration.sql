-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "colorFamily" TEXT NOT NULL,
    "colors" TEXT[],
    "pattern" TEXT,
    "seasons" TEXT[],
    "occasions" TEXT[],
    "price" DECIMAL(10,2),
    "url" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WANT',
    "imageOriginalPath" TEXT,
    "imageDisplayPath" TEXT,
    "imageThumbnailPath" TEXT,
    "boughtItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_status_idx" ON "WishlistItem"("userId", "status");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
