-- CreateEnum
CREATE TYPE "SetupJobCommand" AS ENUM ('ONBOARD', 'RETRO_SPEC');

-- AlterTable
ALTER TABLE "ProjectSetupJob" ADD COLUMN     "command" "SetupJobCommand" NOT NULL DEFAULT 'ONBOARD',
ADD COLUMN     "context" TEXT,
ADD COLUMN     "depth" VARCHAR(20),
ADD COLUMN     "docUrl" VARCHAR(2000);

-- CreateIndex
CREATE INDEX "ProjectSetupJob_projectId_command_status_idx" ON "ProjectSetupJob"("projectId", "command", "status");
