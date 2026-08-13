-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "invoiceDueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reimbursement_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reimbursement_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reimbursement_personId_idx" ON "Reimbursement"("personId");

-- CreateIndex
CREATE INDEX "Reimbursement_paymentMethodId_idx" ON "Reimbursement"("paymentMethodId");

-- CreateIndex
CREATE INDEX "Reimbursement_invoiceDueDate_idx" ON "Reimbursement"("invoiceDueDate");
