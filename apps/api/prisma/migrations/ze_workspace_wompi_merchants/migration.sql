CREATE TABLE "WompiMerchant" (
 "workspaceId" TEXT PRIMARY KEY,
 "publicKeyHash" TEXT NOT NULL,
 "encryptedCredentials" TEXT NOT NULL,
 "acceptingPayments" BOOLEAN NOT NULL DEFAULT false,
 "configuredByUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WompiMerchant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WompiMerchant_publicKeyHash_key" ON "WompiMerchant"("publicKeyHash");
