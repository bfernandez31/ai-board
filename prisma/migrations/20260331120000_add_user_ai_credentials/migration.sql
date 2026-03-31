-- CreateEnum
CREATE TYPE "AiCredentialProvider" AS ENUM ('ANTHROPIC');

-- CreateEnum
CREATE TYPE "AiCredentialType" AS ENUM ('ANTHROPIC_API_KEY', 'ANTHROPIC_OAUTH');

-- CreateEnum
CREATE TYPE "AiCredentialReadinessStatus" AS ENUM ('PENDING_VERIFICATION', 'READY', 'ACTION_REQUIRED');

-- CreateTable
CREATE TABLE "UserAiCredential" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiCredentialProvider" NOT NULL,
    "credentialType" "AiCredentialType" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "maskedPreview" VARCHAR(4) NOT NULL,
    "encryptedSecret" TEXT,
    "encryptionIv" VARCHAR(64),
    "encryptionAuthTag" VARCHAR(64),
    "readinessStatus" "AiCredentialReadinessStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastVerificationCode" VARCHAR(50),
    "lastVerificationMessage" VARCHAR(500),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAiCredential_userId_provider_key" ON "UserAiCredential"("userId", "provider");

-- CreateIndex
CREATE INDEX "UserAiCredential_userId_idx" ON "UserAiCredential"("userId");

-- CreateIndex
CREATE INDEX "UserAiCredential_provider_readinessStatus_idx" ON "UserAiCredential"("provider", "readinessStatus");

-- CreateIndex
CREATE INDEX "UserAiCredential_deletedAt_idx" ON "UserAiCredential"("deletedAt");

-- AddForeignKey
ALTER TABLE "UserAiCredential" ADD CONSTRAINT "UserAiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
