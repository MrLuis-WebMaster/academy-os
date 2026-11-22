CREATE TABLE "WeeklyAvailability" (
 "id" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"teacherProfileId" TEXT NOT NULL,
 "dayOfWeek" INTEGER NOT NULL,"startMinute" INTEGER NOT NULL,"endMinute" INTEGER NOT NULL,
 CONSTRAINT "WeeklyAvailability_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "WeeklyAvailability_day_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
 CONSTRAINT "WeeklyAvailability_time_check" CHECK ("startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 15 AND 1440 AND "endMinute" - "startMinute" >= 15)
);
CREATE INDEX "WeeklyAvailability_workspaceId_teacherProfileId_dayOfWeek_idx" ON "WeeklyAvailability"("workspaceId","teacherProfileId","dayOfWeek");
ALTER TABLE "WeeklyAvailability" ADD CONSTRAINT "WeeklyAvailability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyAvailability" ADD CONSTRAINT "WeeklyAvailability_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
