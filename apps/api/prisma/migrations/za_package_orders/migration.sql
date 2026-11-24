CREATE TYPE "PackageOrderStatus" AS ENUM ('PENDING','FULFILLED','CANCELLED','REJECTED');
CREATE TABLE "PackageOrder" (
 "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "packageId" TEXT NOT NULL, "studentUserId" TEXT NOT NULL,
 "requestId" TEXT NOT NULL, "title" TEXT NOT NULL, "priceCOP" INTEGER NOT NULL, "credits" INTEGER NOT NULL,
 "validDays" INTEGER NOT NULL, "courseIdSnapshot" TEXT, "status" "PackageOrderStatus" NOT NULL DEFAULT 'PENDING',
 "paymentReference" TEXT, "reviewedByUserId" TEXT, "reviewNote" TEXT, "reviewedAt" TIMESTAMP(3),
 "entitlementId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PackageOrder_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PackageOrder_values_check" CHECK ("priceCOP">0 AND "credits">0 AND "validDays">0),
 CONSTRAINT "PackageOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "PackageOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PackageOrder_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PackageOrder_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "PackageOrder_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "ClassPackageEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackageOrder_entitlementId_key" ON "PackageOrder"("entitlementId");
CREATE UNIQUE INDEX "PackageOrder_workspaceId_studentUserId_requestId_key" ON "PackageOrder"("workspaceId","studentUserId","requestId");
CREATE UNIQUE INDEX "PackageOrder_workspaceId_paymentReference_key" ON "PackageOrder"("workspaceId","paymentReference");
CREATE INDEX "PackageOrder_workspaceId_status_createdAt_idx" ON "PackageOrder"("workspaceId","status","createdAt");
