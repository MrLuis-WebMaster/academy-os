-- Preserve course-only entitlement semantics even when the related course is deleted.
ALTER TABLE "ClassPackage" ADD COLUMN "courseRestricted" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ClassPackage" SET "courseRestricted" = true WHERE "courseId" IS NOT NULL;
