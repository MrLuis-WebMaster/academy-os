-- Record who revoked staff-issued class credits and why.
ALTER TABLE "ClassPackageEntitlement" ADD COLUMN "revokedByUserId" TEXT;
ALTER TABLE "ClassPackageEntitlement" ADD COLUMN "revokeReason" TEXT;
ALTER TABLE "ClassPackageEntitlement" ADD CONSTRAINT "ClassPackageEntitlement_revokedByUserId_fkey"
 FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
