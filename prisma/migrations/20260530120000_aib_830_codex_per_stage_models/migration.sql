-- AIB-830: Per-stage model selection for Codex agent.
-- Adds 5 nullable VARCHAR(50) columns to both Project and Ticket so Codex per-stage
-- selections can be stored independently of the existing Claude per-stage columns.

ALTER TABLE "Project"
    ADD COLUMN "codexSpecifyModel"   VARCHAR(50),
    ADD COLUMN "codexPlanModel"      VARCHAR(50),
    ADD COLUMN "codexImplementModel" VARCHAR(50),
    ADD COLUMN "codexQuickImplModel" VARCHAR(50),
    ADD COLUMN "codexVerifyModel"    VARCHAR(50);

ALTER TABLE "Ticket"
    ADD COLUMN "codexSpecifyModel"   VARCHAR(50),
    ADD COLUMN "codexPlanModel"      VARCHAR(50),
    ADD COLUMN "codexImplementModel" VARCHAR(50),
    ADD COLUMN "codexQuickImplModel" VARCHAR(50),
    ADD COLUMN "codexVerifyModel"    VARCHAR(50);
