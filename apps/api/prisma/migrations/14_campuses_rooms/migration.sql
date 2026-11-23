-- Physical campuses and rooms are tenant-scoped. Rooms remain attached to their
-- campus; scheduling only references rooms from the same academy.
CREATE TABLE "Campus" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeachingRoom" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campusId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingRoom_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ClassSession" ADD COLUMN "roomId" TEXT;
CREATE UNIQUE INDEX "Campus_workspaceId_name_key" ON "Campus"("workspaceId","name");
CREATE INDEX "Campus_workspaceId_active_idx" ON "Campus"("workspaceId","active");
CREATE UNIQUE INDEX "TeachingRoom_campusId_name_key" ON "TeachingRoom"("campusId","name");
CREATE INDEX "TeachingRoom_workspaceId_active_idx" ON "TeachingRoom"("workspaceId","active");
CREATE INDEX "ClassSession_roomId_startsAt_idx" ON "ClassSession"("roomId","startsAt");
ALTER TABLE "Campus"
  ADD CONSTRAINT "Campus_workspaceId_fkey" FOREIGN KEY ("workspaceId")
  REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingRoom"
  ADD CONSTRAINT "TeachingRoom_workspaceId_fkey" FOREIGN KEY ("workspaceId")
  REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingRoom"
  ADD CONSTRAINT "TeachingRoom_campusId_fkey" FOREIGN KEY ("campusId")
  REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassSession"
  ADD CONSTRAINT "ClassSession_roomId_fkey" FOREIGN KEY ("roomId")
  REFERENCES "TeachingRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
