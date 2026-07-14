-- CreateTable
CREATE TABLE "PromptOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "overrideText" TEXT,
    "appendText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromptOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PromptOverride_userId_idx" ON "PromptOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptOverride_userId_promptId_key" ON "PromptOverride"("userId", "promptId");
