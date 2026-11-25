CREATE TABLE "EmailNoticePreference" (
 "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "enabledSince" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("workspaceId","userId")
);
CREATE TABLE "EmailNoticeDelivery" (
 "notificationId" TEXT PRIMARY KEY REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "state" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("state" IN ('QUEUED','SENT','SKIPPED','FAILED')),
 "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts">=0),
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "providerId" TEXT,
 "errorCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "EmailNoticeDelivery_state_nextAttemptAt_idx" ON "EmailNoticeDelivery"("state","nextAttemptAt");
