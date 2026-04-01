-- CreateEnum
CREATE TYPE "CredentialProvider" AS ENUM ('ANTHROPIC');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('API_KEY', 'OAUTH_TOKEN');

-- CreateEnum
CREATE TYPE "CredentialReadiness" AS ENUM ('PENDING_VERIFICATION', 'READY', 'ACTION_REQUIRED');

-- CreateTable
CREATE TABLE "UserCredential" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CredentialProvider" NOT NULL,
    "credentialType" "CredentialType" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" VARCHAR(24) NOT NULL,
    "authTag" VARCHAR(24) NOT NULL,
    "preview" VARCHAR(4) NOT NULL,
    "readinessStatus" "CredentialReadiness" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationCode" VARCHAR(50),
    "verificationMessage" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCredential_userId_idx" ON "UserCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_userId_provider_key" ON "UserCredential"("userId", "provider");

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
