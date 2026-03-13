-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateEnum
CREATE TYPE "AiCredentialValidationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'ERROR');

-- CreateEnum
CREATE TYPE "WorkflowCredentialSource" AS ENUM ('PROJECT_BYOK');

-- CreateTable
CREATE TABLE "ProjectAiCredential" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "encryptionIv" VARCHAR(64) NOT NULL,
    "encryptionTag" VARCHAR(64) NOT NULL,
    "lastFour" VARCHAR(4) NOT NULL,
    "validationStatus" "AiCredentialValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationMessage" VARCHAR(255),
    "validatedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAiCredentialSnapshot" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "source" "WorkflowCredentialSource" NOT NULL,
    "projectAiCredentialId" INTEGER NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "encryptionIv" VARCHAR(64) NOT NULL,
    "encryptionTag" VARCHAR(64) NOT NULL,
    "lastFour" VARCHAR(4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAiCredentialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAiCredential_projectId_idx" ON "ProjectAiCredential"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAiCredential_projectId_validationStatus_idx" ON "ProjectAiCredential"("projectId", "validationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAiCredential_projectId_provider_key" ON "ProjectAiCredential"("projectId", "provider");

-- CreateIndex
CREATE INDEX "JobAiCredentialSnapshot_projectId_jobId_idx" ON "JobAiCredentialSnapshot"("projectId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobAiCredentialSnapshot_jobId_provider_key" ON "JobAiCredentialSnapshot"("jobId", "provider");

-- AddForeignKey
ALTER TABLE "ProjectAiCredential" ADD CONSTRAINT "ProjectAiCredential_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAiCredential" ADD CONSTRAINT "ProjectAiCredential_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAiCredential" ADD CONSTRAINT "ProjectAiCredential_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAiCredentialSnapshot" ADD CONSTRAINT "JobAiCredentialSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAiCredentialSnapshot" ADD CONSTRAINT "JobAiCredentialSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAiCredentialSnapshot" ADD CONSTRAINT "JobAiCredentialSnapshot_projectAiCredentialId_fkey" FOREIGN KEY ("projectAiCredentialId") REFERENCES "ProjectAiCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
