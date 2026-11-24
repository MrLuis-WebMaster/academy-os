CREATE TABLE "PackageCheckout" (
 "orderId" TEXT PRIMARY KEY,
 "reference" TEXT NOT NULL UNIQUE,
 "merchantKeyHash" TEXT NOT NULL,
 "environment" TEXT NOT NULL CHECK ("environment" IN ('test','prod')),
 "amountInCents" BIGINT NOT NULL CHECK ("amountInCents">0),
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "providerTransactionId" TEXT UNIQUE,
 "providerStatus" TEXT NOT NULL DEFAULT 'PENDING',
 "resolution" TEXT NOT NULL DEFAULT 'WAITING',
 "verifiedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PackageCheckout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PackageOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
