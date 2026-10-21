-- AlterTable
ALTER TABLE "ClothingImage" ADD COLUMN     "cutoutAt" TIMESTAMP(3),
ADD COLUMN     "cutoutError" TEXT,
ADD COLUMN     "cutoutPath" TEXT,
ADD COLUMN     "cutoutStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "cutoutThumbPath" TEXT;

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_userId_day_key" ON "AiUsage"("userId", "day");

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
