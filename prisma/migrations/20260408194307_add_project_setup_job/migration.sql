-- CreateTable
CREATE TABLE "ProjectSetupJob" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "agent" "Agent" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "workflowRunId" BIGINT,
    "logs" TEXT,
    "artifactSummary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSetupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSetupJob_projectId_idx" ON "ProjectSetupJob"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSetupJob" ADD CONSTRAINT "ProjectSetupJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
