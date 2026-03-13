-- CreateEnum
CREATE TYPE "ApiKeyProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateTable
CREATE TABLE "ProjectApiKey" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "provider" "ApiKeyProvider" NOT NULL,
    "encryptedKey" VARCHAR(500) NOT NULL,
    "preview" VARCHAR(4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectApiKey_projectId_idx" ON "ProjectApiKey"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectApiKey_projectId_provider_key" ON "ProjectApiKey"("projectId", "provider");

-- AddForeignKey
ALTER TABLE "ProjectApiKey" ADD CONSTRAINT "ProjectApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
