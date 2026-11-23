-- Preserve free courses and all existing reservations by default.
ALTER TABLE "Course" ADD COLUMN "requiresPackage" BOOLEAN NOT NULL DEFAULT false;
