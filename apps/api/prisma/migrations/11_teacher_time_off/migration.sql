CREATE TABLE "TeacherTimeOff" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherTimeOff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeacherTimeOff_valid_period" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "TeacherTimeOff_workspaceId_teacherProfileId_startsAt_endsAt_idx"
  ON "TeacherTimeOff"("workspaceId","teacherProfileId","startsAt","endsAt");
ALTER TABLE "TeacherTimeOff" ADD CONSTRAINT "TeacherTimeOff_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherTimeOff" ADD CONSTRAINT "TeacherTimeOff_teacherProfileId_fkey"
 FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
