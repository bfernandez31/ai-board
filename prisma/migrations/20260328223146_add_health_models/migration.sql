-- CreateEnum
CREATE TYPE "HealthScanType" AS ENUM ('SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC');

-- CreateEnum
CREATE TYPE "HealthScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "HealthScan" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "scanType" "HealthScanType" NOT NULL,
    "status" "HealthScanStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "report" JSONB,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "issuesFixed" INTEGER NOT NULL DEFAULT 0,
    "baseCommit" VARCHAR(40),
    "headCommit" VARCHAR(40),
    "ticketsCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" VARCHAR(2000),
    "durationMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScore" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "globalScore" INTEGER,
    "securityScore" INTEGER,
    "complianceScore" INTEGER,
    "testsScore" INTEGER,
    "specSyncScore" INTEGER,
    "qualityGateScore" INTEGER,
    "lastScanAt" TIMESTAMP(3),
    "lastSecurityScanAt" TIMESTAMP(3),
    "lastComplianceScanAt" TIMESTAMP(3),
    "lastTestsScanAt" TIMESTAMP(3),
    "lastSpecSyncScanAt" TIMESTAMP(3),
    "lastCleanAt" TIMESTAMP(3),
    "lastCleanJobId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthScan_projectId_scanType_createdAt_idx" ON "HealthScan"("projectId", "scanType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HealthScan_projectId_status_idx" ON "HealthScan"("projectId", "status");

-- CreateIndex
CREATE INDEX "HealthScan_projectId_scanType_status_idx" ON "HealthScan"("projectId", "scanType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScore_projectId_key" ON "HealthScore"("projectId");

-- CreateIndex
CREATE INDEX "HealthScore_projectId_idx" ON "HealthScore"("projectId");

-- AddForeignKey
ALTER TABLE "HealthScan" ADD CONSTRAINT "HealthScan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScore" ADD CONSTRAINT "HealthScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
