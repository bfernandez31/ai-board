-- CreateTable
CREATE TABLE "public"."Project" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "githubOwner" VARCHAR(100) NOT NULL,
    "githubRepo" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_githubOwner_githubRepo_idx" ON "public"."Project"("githubOwner", "githubRepo");

-- CreateIndex
CREATE UNIQUE INDEX "Project_githubOwner_githubRepo_key" ON "public"."Project"("githubOwner", "githubRepo");
