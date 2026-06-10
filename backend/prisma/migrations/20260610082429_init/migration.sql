-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raceName" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "stints" JSONB NOT NULL,
    "predictedPosition" INTEGER NOT NULL,
    "timeDelta" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedRaceResult" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CachedRaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "CachedRaceResult_year_round_key" ON "CachedRaceResult"("year", "round");

-- AddForeignKey
ALTER TABLE "SavedStrategy" ADD CONSTRAINT "SavedStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
