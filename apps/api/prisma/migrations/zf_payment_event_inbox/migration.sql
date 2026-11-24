CREATE TABLE "PaymentEventInbox" (
 "id" TEXT PRIMARY KEY,
 "workspaceId" TEXT NOT NULL,
 "environment" TEXT NOT NULL CHECK ("environment" IN ('test','prod')),
 "merchantKeyHash" TEXT NOT NULL,
 "eventKey" TEXT NOT NULL,
 "transactionId" TEXT NOT NULL,
 "amountInCents" BIGINT NOT NULL CHECK ("amountInCents">0),
 "signedStatus" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("state" IN ('QUEUED','DONE','IGNORED','REVIEW','FAILED')),
 "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts">=0),
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "lastErrorCode" TEXT,
 "resolution" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "processedAt" TIMESTAMP(3),
 CONSTRAINT "PaymentEventInbox_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentEventInbox_workspaceId_environment_merchantKeyHash_eventKey_key" ON "PaymentEventInbox"("workspaceId","environment","merchantKeyHash","eventKey");
CREATE INDEX "PaymentEventInbox_workspaceId_state_nextAttemptAt_idx" ON "PaymentEventInbox"("workspaceId","state","nextAttemptAt");
CREATE INDEX "PaymentEventInbox_workspaceId_createdAt_id_idx" ON "PaymentEventInbox"("workspaceId","createdAt","id");
