-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC');

-- CreateEnum
CREATE TYPE "AiCredentialType" AS ENUM ('API_KEY', 'OAUTH_TOKEN');

-- CreateTable
CREATE TABLE "UserAiCredential" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "credentialType" "AiCredentialType" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" VARCHAR(64) NOT NULL,
    "authTag" VARCHAR(64) NOT NULL,
    "preview" VARCHAR(4) NOT NULL,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAiCredential_userId_idx" ON "UserAiCredential"("userId");

-- CreateIndex
CREATE INDEX "UserAiCredential_provider_idx" ON "UserAiCredential"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserAiCredential_userId_provider_key" ON "UserAiCredential"("userId", "provider");

-- AddForeignKey
ALTER TABLE "UserAiCredential" ADD CONSTRAINT "UserAiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
