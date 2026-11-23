-- Staff-issued educational class packages (no checkout or proof of payment).
CREATE TABLE "ClassPackage" (
 "id" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "courseId" TEXT,
 "title" TEXT NOT NULL,
 "sessionCredits" INTEGER NOT NULL,
 "priceCOP" INTEGER NOT NULL,
 "validDays" INTEGER NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ClassPackage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassPackageEntitlement" (
 "id" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "packageId" TEXT NOT NULL,
 "studentUserId" TEXT NOT NULL,
 "issuedByUserId" TEXT NOT NULL,
 "credits" INTEGER NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revokedAt" TIMESTAMP(3),
 "note" TEXT,
 CONSTRAINT "ClassPackageEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassPackageRedemption" (
 "id" TEXT NOT NULL,
 "entitlementId" TEXT NOT NULL,
 "bookingId" TEXT NOT NULL,
 "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "refundedAt" TIMESTAMP(3),
 CONSTRAINT "ClassPackageRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClassPackage_workspaceId_active_idx" ON "ClassPackage"("workspaceId","active");
CREATE INDEX "ClassPackageEntitlement_workspaceId_studentUserId_expiresAt_idx"
 ON "ClassPackageEntitlement"("workspaceId","studentUserId","expiresAt");
CREATE UNIQUE INDEX "ClassPackageRedemption_bookingId_key" ON "ClassPackageRedemption"("bookingId");
CREATE INDEX "ClassPackageRedemption_entitlementId_refundedAt_idx"
 ON "ClassPackageRedemption"("entitlementId","refundedAt");
ALTER TABLE "ClassPackage" ADD CONSTRAINT "ClassPackage_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassPackage" ADD CONSTRAINT "ClassPackage_courseId_fkey"
 FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassPackageEntitlement" ADD CONSTRAINT "ClassPackageEntitlement_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassPackageEntitlement" ADD CONSTRAINT "ClassPackageEntitlement_packageId_fkey"
 FOREIGN KEY ("packageId") REFERENCES "ClassPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassPackageEntitlement" ADD CONSTRAINT "ClassPackageEntitlement_studentUserId_fkey"
 FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPackageEntitlement" ADD CONSTRAINT "ClassPackageEntitlement_issuedByUserId_fkey"
 FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPackageRedemption" ADD CONSTRAINT "ClassPackageRedemption_entitlementId_fkey"
 FOREIGN KEY ("entitlementId") REFERENCES "ClassPackageEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassPackageRedemption" ADD CONSTRAINT "ClassPackageRedemption_bookingId_fkey"
 FOREIGN KEY ("bookingId") REFERENCES "ClassBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
