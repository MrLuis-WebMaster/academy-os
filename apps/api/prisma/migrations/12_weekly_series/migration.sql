CREATE TABLE "ClassSeries" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "firstStartsAt" TIMESTAMP(3) NOT NULL,
  "repeatWeeks" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassSeries_repeatWeeks_check" CHECK ("repeatWeeks" BETWEEN 2 AND 16)
);
CREATE INDEX "ClassSeries_workspaceId_teacherProfileId_firstStartsAt_idx"
  ON "ClassSeries"("workspaceId","teacherProfileId","firstStartsAt");
ALTER TABLE "ClassSeries" ADD CONSTRAINT "ClassSeries_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassSeries" ADD CONSTRAINT "ClassSeries_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassSession" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "ClassSession" ADD COLUMN "seriesIndex" INTEGER;
CREATE INDEX "ClassSession_seriesId_idx" ON "ClassSession"("seriesId");
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "ClassSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
