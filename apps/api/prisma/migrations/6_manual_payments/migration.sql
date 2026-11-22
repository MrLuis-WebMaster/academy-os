CREATE TYPE "ManualPaymentMethod" AS ENUM ('CASH','BANK_TRANSFER','OTHER');
CREATE TABLE "PaymentReceipt" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "courseId" TEXT,
  "studentUserId" TEXT NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "amountCOP" INTEGER NOT NULL,
  "method" "ManualPaymentMethod" NOT NULL,
  "reference" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentReceipt_workspaceId_receivedAt_idx" ON "PaymentReceipt"("workspaceId","receivedAt");
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
