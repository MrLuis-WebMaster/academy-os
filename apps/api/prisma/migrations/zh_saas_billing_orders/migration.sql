CREATE TABLE "SaasBillingOrder" (
 "id" TEXT PRIMARY KEY,
 "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestedByUserId" TEXT NOT NULL,
 "requestId" TEXT NOT NULL UNIQUE,
 "plan" "SaasPlanCode" NOT NULL CHECK ("plan" IN ('PRO','ACADEMY')),
 "interval" TEXT NOT NULL CHECK ("interval" IN ('MONTHLY','YEARLY')),
 "amountCOP" INTEGER NOT NULL CHECK ("amountCOP">0 AND "amountCOP"<=500000000),
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PAID','CANCELLED','REJECTED')),
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "paymentReference" TEXT UNIQUE,
 "paidByUserId" TEXT,
 "paidAt" TIMESTAMP(3),
 "periodStart" TIMESTAMP(3),
 "periodEnd" TIMESTAMP(3),
 "resolutionNote" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("status"<>'PAID' OR ("paymentReference" IS NOT NULL AND "paidByUserId" IS NOT NULL AND "paidAt" IS NOT NULL AND "periodStart" IS NOT NULL AND "periodEnd" > "periodStart"))
);
CREATE INDEX "SaasBillingOrder_workspaceId_createdAt_id_idx" ON "SaasBillingOrder"("workspaceId","createdAt","id");
CREATE INDEX "SaasBillingOrder_workspaceId_status_periodEnd_idx" ON "SaasBillingOrder"("workspaceId","status","periodEnd");
