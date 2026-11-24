ALTER TABLE "PackageCheckout" ADD COLUMN "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "checkAttempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "checkLease" TEXT,
 ADD COLUMN "checkLeaseUntil" TIMESTAMP(3),
 ADD COLUMN "checkError" TEXT;
CREATE INDEX "PackageCheckout_nextCheckAt_idx" ON "PackageCheckout"("nextCheckAt");
