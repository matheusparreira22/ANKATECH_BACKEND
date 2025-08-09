-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('LIFE', 'DISABILITY', 'HEALTH', 'AUTO', 'HOME', 'TRAVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "insurances" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "InsuranceType" NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT,
    "coverage" DECIMAL(15,2) NOT NULL,
    "premium" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "InsuranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "beneficiaries" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurances_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
