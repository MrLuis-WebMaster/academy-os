-- Public branded storefront, disabled until the owner enables it.
ALTER TABLE "Workspace" ADD COLUMN "description" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "contactUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "publicEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "Offering" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "courseId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priceCOP" INTEGER NOT NULL DEFAULT 0,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "mode" "SessionMode" NOT NULL DEFAULT 'ONLINE',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Offering_workspaceId_published_idx" ON "Offering"("workspaceId", "published");
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
