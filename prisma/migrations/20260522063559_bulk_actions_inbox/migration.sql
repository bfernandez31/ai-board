-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'TICKET_DELETED', 'TICKET_MERGED');

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_ticketId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "mergedIntoTicketId" INTEGER,
ADD COLUMN     "ticketKeySnapshot" VARCHAR(20),
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'MENTION',
ALTER COLUMN "commentId" DROP NOT NULL,
ALTER COLUMN "ticketId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "creatorId" VARCHAR(255);

-- CreateIndex
CREATE INDEX "Ticket_creatorId_idx" ON "Ticket"("creatorId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_mergedIntoTicketId_fkey" FOREIGN KEY ("mergedIntoTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
