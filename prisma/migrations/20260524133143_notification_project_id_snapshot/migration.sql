-- AIB-821 review fix: persist projectId at notification creation time so
-- TICKET_DELETED notifications still have a usable navigation URL after the
-- source ticket is removed (SetNull cascade nulls Notification.ticketId).

ALTER TABLE "Notification" ADD COLUMN "projectIdSnapshot" INTEGER;
