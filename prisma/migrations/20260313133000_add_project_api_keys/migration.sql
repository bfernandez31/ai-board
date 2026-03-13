ALTER TABLE "Project"
ADD COLUMN "anthropicApiKeyEncrypted" TEXT,
ADD COLUMN "anthropicApiKeyPreview" VARCHAR(4),
ADD COLUMN "openaiApiKeyEncrypted" TEXT,
ADD COLUMN "openaiApiKeyPreview" VARCHAR(4);
