ALTER TABLE "ExternalConnection" ADD COLUMN "encryptedCredentials" TEXT;
CREATE TABLE "IntegrationOAuthAttempt" (
 "stateHash" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "encryptedVerifier" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "claimedAt" TIMESTAMP(3),
 CONSTRAINT "IntegrationOAuthAttempt_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "IntegrationOAuthAttempt_workspaceId_userId_idx" ON "IntegrationOAuthAttempt"("workspaceId","userId");
CREATE INDEX "IntegrationOAuthAttempt_expiresAt_idx" ON "IntegrationOAuthAttempt"("expiresAt");
