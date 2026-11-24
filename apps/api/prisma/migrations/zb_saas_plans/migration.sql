CREATE TYPE "SaasPlanCode" AS ENUM ('STARTER','PRO','ACADEMY');
CREATE TABLE "SaasSubscription" (
 "workspaceId" TEXT PRIMARY KEY, "plan" "SaasPlanCode" NOT NULL, "validUntil" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SaasSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "SaasPlanChange" (
 "id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "previousPlan" "SaasPlanCode" NOT NULL, "nextPlan" "SaasPlanCode" NOT NULL, "validUntil" TIMESTAMP(3),
 "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SaasPlanChange_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SaasPlanChange_workspaceId_createdAt_idx" ON "SaasPlanChange"("workspaceId","createdAt");
