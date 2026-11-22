CREATE TABLE "AiGeneration" (
 "id" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL,
 "activityId" TEXT,
 "model" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiGeneration_workspaceId_createdAt_idx" ON "AiGeneration"("workspaceId","createdAt");
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
