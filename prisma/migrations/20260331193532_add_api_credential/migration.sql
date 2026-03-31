-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('API_KEY', 'OAUTH_TOKEN');

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "credentialType" "CredentialType" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "encryptedKey" VARCHAR(500) NOT NULL,
    "iv" VARCHAR(32) NOT NULL,
    "authTag" VARCHAR(32) NOT NULL,
    "preview" VARCHAR(4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiCredential_userId_idx" ON "ApiCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_userId_provider_key" ON "ApiCredential"("userId", "provider");

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
