-- Independent methodology per teacher within a workspace; no assistant enabled by default.
CREATE TYPE "TeachingSpecialty" AS ENUM (
 'GENERAL','LANGUAGES','MATHEMATICS','MUSIC','ART_DESIGN','SCHOOL_SUPPORT','EXAM_PREP'
);
CREATE TYPE "TeachingStyle" AS ENUM (
 'SOCRATIC','STEP_BY_STEP','CONVERSATIONAL','PRACTICAL','VISUAL'
);
CREATE TABLE "TeachingMethodology" (
 "id" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "teacherProfileId" TEXT NOT NULL,
 "specialty" "TeachingSpecialty" NOT NULL DEFAULT 'GENERAL',
 "style" "TeachingStyle" NOT NULL DEFAULT 'SOCRATIC',
 "language" TEXT NOT NULL DEFAULT 'es',
 "guidance" TEXT NOT NULL DEFAULT '',
 "sosEnabled" BOOLEAN NOT NULL DEFAULT false,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "TeachingMethodology_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeachingMethodology_teacherProfileId_key" ON "TeachingMethodology"("teacherProfileId");
CREATE INDEX "TeachingMethodology_workspaceId_idx" ON "TeachingMethodology"("workspaceId");
ALTER TABLE "TeachingMethodology" ADD CONSTRAINT "TeachingMethodology_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingMethodology" ADD CONSTRAINT "TeachingMethodology_teacherProfileId_fkey"
 FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
