-- CreateTable
CREATE TABLE "CompanyResearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "context" TEXT,
    "contextAt" DATETIME,
    "contextSources" TEXT,
    "process" TEXT,
    "processAt" DATETIME,
    "websiteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyResearch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyResearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewPrep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "process" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewPrep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewPrep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyResearch_companyId_key" ON "CompanyResearch"("companyId");

-- CreateIndex
CREATE INDEX "CompanyResearch_userId_idx" ON "CompanyResearch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPrep_jobId_key" ON "InterviewPrep"("jobId");

-- CreateIndex
CREATE INDEX "InterviewPrep_userId_idx" ON "InterviewPrep"("userId");
