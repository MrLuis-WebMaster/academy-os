CREATE TABLE "SessionChange" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "oldStartsAt" TIMESTAMP(3) NOT NULL,
  "oldEndsAt" TIMESTAMP(3) NOT NULL,
  "newStartsAt" TIMESTAMP(3) NOT NULL,
  "newEndsAt" TIMESTAMP(3) NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SessionChange_sessionId_changedAt_idx" ON "SessionChange"("sessionId","changedAt");
ALTER TABLE "SessionChange" ADD CONSTRAINT "SessionChange_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionChange" ADD CONSTRAINT "SessionChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
