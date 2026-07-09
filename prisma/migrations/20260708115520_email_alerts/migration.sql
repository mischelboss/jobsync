-- AlterTable
ALTER TABLE "Job" ADD COLUMN "contentFingerprint" TEXT;

-- CreateTable
CREATE TABLE "ImapConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "useTls" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImapConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessedAlertEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedAlertEmail_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Automation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'jobboard',
    "jobBoard" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "sourceConfig" TEXT,
    "emailFilterType" TEXT,
    "emailFilterValue" TEXT,
    "followLinks" BOOLEAN NOT NULL DEFAULT false,
    "resumeId" TEXT NOT NULL,
    "matchThreshold" INTEGER NOT NULL DEFAULT 80,
    "scheduleHour" INTEGER NOT NULL,
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Automation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Automation" ("createdAt", "id", "jobBoard", "keywords", "lastRunAt", "location", "matchThreshold", "name", "nextRunAt", "resumeId", "scheduleHour", "sourceConfig", "status", "updatedAt", "userId") SELECT "createdAt", "id", "jobBoard", "keywords", "lastRunAt", "location", "matchThreshold", "name", "nextRunAt", "resumeId", "scheduleHour", "sourceConfig", "status", "updatedAt", "userId" FROM "Automation";
DROP TABLE "Automation";
ALTER TABLE "new_Automation" RENAME TO "Automation";
CREATE INDEX "Automation_userId_idx" ON "Automation"("userId");
CREATE INDEX "Automation_status_nextRunAt_idx" ON "Automation"("status", "nextRunAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ImapConfig_userId_key" ON "ImapConfig"("userId");

-- CreateIndex
CREATE INDEX "ProcessedAlertEmail_automationId_idx" ON "ProcessedAlertEmail"("automationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedAlertEmail_automationId_messageId_key" ON "ProcessedAlertEmail"("automationId", "messageId");

-- CreateIndex
CREATE INDEX "Job_userId_contentFingerprint_idx" ON "Job"("userId", "contentFingerprint");
