-- AIB-797: Add CronRunLog model for tracking critical cron success markers.

CREATE TABLE "CronRunLog" (
    "id" SERIAL NOT NULL,
    "workflowName" VARCHAR(100) NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "runUrl" VARCHAR(500),

    CONSTRAINT "CronRunLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CronRunLog_workflowName_ranAt_idx" ON "CronRunLog"("workflowName", "ranAt");
CREATE INDEX "CronRunLog_ranAt_idx" ON "CronRunLog"("ranAt");
