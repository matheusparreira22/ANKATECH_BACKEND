-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_role_idx" ON "Client"("role");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "Simulation_clientId_idx" ON "Simulation"("clientId");

-- CreateIndex
CREATE INDEX "Simulation_createdAt_idx" ON "Simulation"("createdAt");

-- CreateIndex
CREATE INDEX "insurances_clientId_idx" ON "insurances"("clientId");

-- CreateIndex
CREATE INDEX "insurances_type_idx" ON "insurances"("type");

-- CreateIndex
CREATE INDEX "insurances_status_idx" ON "insurances"("status");

-- CreateIndex
CREATE INDEX "insurances_endDate_idx" ON "insurances"("endDate");
