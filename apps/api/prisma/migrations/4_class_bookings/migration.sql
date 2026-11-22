CREATE TYPE "BookingStatus" AS ENUM ('BOOKED','CANCELLED');
CREATE TABLE "ClassBooking" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
  "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "ClassBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassBooking_sessionId_userId_key" ON "ClassBooking"("sessionId","userId");
CREATE INDEX "ClassBooking_workspaceId_status_idx" ON "ClassBooking"("workspaceId","status");
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
