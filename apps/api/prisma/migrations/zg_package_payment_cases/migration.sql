CREATE TABLE "PackagePaymentCase" (
 "orderId" TEXT PRIMARY KEY REFERENCES "PackageOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','CLOSED')),
 "category" TEXT NOT NULL CHECK ("category" IN ('REFUND','DISPUTE','PAYMENT_REVIEW')),
 "openedByUserId" TEXT NOT NULL,
 "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "closedAt" TIMESTAMP(3)
);
CREATE TABLE "PackagePaymentCaseEntry" (
 "id" TEXT PRIMARY KEY,
 "orderId" TEXT NOT NULL REFERENCES "PackagePaymentCase"("orderId") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestId" TEXT NOT NULL UNIQUE,
 "actorUserId" TEXT NOT NULL,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('OPEN','NOTE','REFUND_RECORDED','CLOSE','REOPEN')),
 "note" TEXT NOT NULL,
 "amountCOP" INTEGER,
 "externalReference" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("kind"='REFUND_RECORDED' AND "amountCOP" IS NOT NULL AND "amountCOP">0 AND "externalReference" IS NOT NULL) OR ("kind"<>'REFUND_RECORDED' AND "amountCOP" IS NULL AND "externalReference" IS NULL))
);
CREATE UNIQUE INDEX "PackagePaymentCaseEntry_orderId_externalReference_key" ON "PackagePaymentCaseEntry"("orderId","externalReference");
CREATE INDEX "PackagePaymentCaseEntry_orderId_createdAt_id_idx" ON "PackagePaymentCaseEntry"("orderId","createdAt","id");
