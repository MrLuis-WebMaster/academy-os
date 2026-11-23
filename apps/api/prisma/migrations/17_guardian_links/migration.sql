-- Only manually approved guardian/student relationships may access a family overview.
CREATE TYPE "GuardianLinkStatus" AS ENUM ('PENDING','ACTIVE','REVOKED');
CREATE TABLE "GuardianLink" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "guardianUserId" TEXT NOT NULL,
  "studentUserId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "status" "GuardianLinkStatus" NOT NULL DEFAULT 'PENDING',
  "verificationMethod" TEXT,
  "verificationNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuardianLink_workspaceId_guardianUserId_studentUserId_key"
 ON "GuardianLink"("workspaceId","guardianUserId","studentUserId");
CREATE INDEX "GuardianLink_workspaceId_guardianUserId_status_idx"
 ON "GuardianLink"("workspaceId","guardianUserId","status");
CREATE INDEX "GuardianLink_workspaceId_studentUserId_status_idx"
 ON "GuardianLink"("workspaceId","studentUserId","status");
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_guardianUserId_fkey"
 FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_studentUserId_fkey"
 FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_requestedByUserId_fkey"
 FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_approvedByUserId_fkey"
 FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;

CREATE TABLE "GuardianLinkEvent" (
  "id" TEXT NOT NULL,
  "linkId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "fromStatus" "GuardianLinkStatus",
  "toStatus" "GuardianLinkStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardianLinkEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuardianLinkEvent_linkId_createdAt_idx" ON "GuardianLinkEvent"("linkId","createdAt");
ALTER TABLE "GuardianLinkEvent" ADD CONSTRAINT "GuardianLinkEvent_linkId_fkey"
 FOREIGN KEY ("linkId") REFERENCES "GuardianLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
