-- CreateTable
CREATE TABLE "agent_rate_limits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_rate_limits_windowStart_idx" ON "agent_rate_limits"("windowStart");

-- CreateIndex
CREATE INDEX "agent_rate_limits_organizationId_windowStart_idx" ON "agent_rate_limits"("organizationId", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "agent_rate_limits_organizationId_userId_windowStart_key" ON "agent_rate_limits"("organizationId", "userId", "windowStart");
