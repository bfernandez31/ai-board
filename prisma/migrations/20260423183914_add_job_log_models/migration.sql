-- CreateTable
CREATE TABLE "JobLog" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "agentType" "Agent" NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previewContent" VARCHAR(2000) NOT NULL,
    "fullLogReference" VARCHAR(255) NOT NULL,
    "storageLocation" VARCHAR(100) NOT NULL,
    "contentSize" INTEGER NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" SERIAL NOT NULL,
    "jobLogId" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "messageType" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" VARCHAR(50),
    "metadata" JSONB,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogStorage" (
    "id" SERIAL NOT NULL,
    "jobLogId" INTEGER NOT NULL,
    "storageProvider" VARCHAR(50) NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "contentSize" INTEGER NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogStorage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobLog_jobId_key" ON "JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_timestamp_idx" ON "JobLog"("timestamp");

-- CreateIndex
CREATE INDEX "JobLog_status_idx" ON "JobLog"("status");

-- CreateIndex
CREATE INDEX "JobLog_expirationDate_idx" ON "JobLog"("expirationDate");

-- CreateIndex
CREATE INDEX "LogEntry_jobLogId_sequenceNumber_idx" ON "LogEntry"("jobLogId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "LogEntry_jobLogId_messageType_idx" ON "LogEntry"("jobLogId", "messageType");

-- CreateIndex
CREATE INDEX "LogEntry_jobLogId_timestamp_idx" ON "LogEntry"("jobLogId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "LogStorage_jobLogId_key" ON "LogStorage"("jobLogId");

-- CreateIndex
CREATE INDEX "LogStorage_storageProvider_idx" ON "LogStorage"("storageProvider");

-- CreateIndex
CREATE INDEX "LogStorage_expirationDate_idx" ON "LogStorage"("expirationDate");

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_jobLogId_fkey" FOREIGN KEY ("jobLogId") REFERENCES "JobLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogStorage" ADD CONSTRAINT "LogStorage_jobLogId_fkey" FOREIGN KEY ("jobLogId") REFERENCES "JobLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
