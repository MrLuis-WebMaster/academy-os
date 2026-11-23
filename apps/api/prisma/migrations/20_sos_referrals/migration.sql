-- Manual student-to-teacher help requests, intentionally separate from AI transcripts.
CREATE TYPE "SosReferralStatus" AS ENUM ('OPEN','RESOLVED');
CREATE TABLE "SosReferral" (
 "id" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "courseId" TEXT NOT NULL,
 "studentUserId" TEXT NOT NULL,
 "question" TEXT NOT NULL,
 "status" "SosReferralStatus" NOT NULL DEFAULT 'OPEN',
 "reply" TEXT,
 "resolvedByUserId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "resolvedAt" TIMESTAMP(3),
 CONSTRAINT "SosReferral_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SosReferral_workspaceId_courseId_status_createdAt_idx" ON "SosReferral"("workspaceId","courseId","status","createdAt");
CREATE INDEX "SosReferral_workspaceId_studentUserId_createdAt_idx" ON "SosReferral"("workspaceId","studentUserId","createdAt");
ALTER TABLE "SosReferral" ADD CONSTRAINT "SosReferral_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SosReferral" ADD CONSTRAINT "SosReferral_courseId_fkey"
 FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SosReferral" ADD CONSTRAINT "SosReferral_studentUserId_fkey"
 FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SosReferral" ADD CONSTRAINT "SosReferral_resolvedByUserId_fkey"
 FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
