-- AlterTable: Limit title to 100 characters and make description required with max 1000 characters
ALTER TABLE "Ticket" ALTER COLUMN "title" SET DATA TYPE VARCHAR(100);
ALTER TABLE "Ticket" ALTER COLUMN "description" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000);