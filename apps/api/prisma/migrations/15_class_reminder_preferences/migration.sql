-- Personal in-app reminder preferences, opt-in per academy.
CREATE TABLE "ClassReminderPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "remind24h" BOOLEAN NOT NULL DEFAULT false,
  "remind1h" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassReminderPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassReminderPreference_workspaceId_userId_key"
ON "ClassReminderPreference"("workspaceId","userId");
CREATE INDEX "ClassReminderPreference_workspaceId_userId_idx"
ON "ClassReminderPreference"("workspaceId","userId");
ALTER TABLE "ClassReminderPreference"
ADD CONSTRAINT "ClassReminderPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassReminderPreference"
ADD CONSTRAINT "ClassReminderPreference_userId_fkey" FOREIGN KEY ("userId")
REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
