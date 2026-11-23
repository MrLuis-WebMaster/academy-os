-- Public brand logo is an optional HTTPS URL; all other workspace data remains private.
ALTER TABLE "Workspace" ADD COLUMN "logoUrl" TEXT;
