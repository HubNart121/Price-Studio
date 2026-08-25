CREATE TYPE "PricingMode" AS ENUM ('SIMPLE', 'ADVANCED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "categoryId" TEXT,
    "mode" "PricingMode" NOT NULL,
    "projectDate" DATE NOT NULL,
    "productName" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "currencyCode" TEXT NOT NULL DEFAULT 'CNY',
    "unitForeignPrice" DECIMAL(18,4) NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "overseasShippingPct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "domesticPackingPct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "internationalFreight" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "insurance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dutyRatePct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "otherTaxFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "brokerFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "domesticLogistics" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherExpenses" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vatRatePct" DECIMAL(9,4) NOT NULL DEFAULT 7,
    "includeVatInCost" BOOLEAN NOT NULL DEFAULT true,
    "gpMarginPct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "goodsValue" DECIMAL(18,2) NOT NULL,
    "cifValue" DECIMAL(18,2) NOT NULL,
    "importDuty" DECIMAL(18,2) NOT NULL,
    "importVat" DECIMAL(18,2) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "costPerUnit" DECIMAL(18,4) NOT NULL,
    "sellingPricePerUnit" DECIMAL(18,4) NOT NULL,
    "profitPerUnit" DECIMAL(18,4) NOT NULL,
    "totalProfit" DECIMAL(18,2) NOT NULL,
    "formulaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Category_ownerId_name_key" ON "Category"("ownerId", "name");
CREATE INDEX "Category_ownerId_isActive_idx" ON "Category"("ownerId", "isActive");
CREATE INDEX "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt");
CREATE INDEX "Project_ownerId_categoryId_idx" ON "Project"("ownerId", "categoryId");
CREATE INDEX "Project_ownerId_mode_idx" ON "Project"("ownerId", "mode");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
