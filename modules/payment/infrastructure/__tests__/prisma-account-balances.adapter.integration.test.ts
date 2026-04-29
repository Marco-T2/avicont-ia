import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { AccountBalancesPort } from "../../domain/ports/account-balances.port";
import type { JournalEntrySnapshot } from "../../domain/ports/accounting.port";
import { PrismaAccountBalancesAdapter } from "../adapters/prisma-account-balances.adapter";

/**
 * Postgres-real integration test for PrismaAccountBalancesAdapter (POC #10
 * sub-fase D Ciclo 1). Mirrors `prisma-account-balances.repo.integration.test.ts`
 * (modules/accounting C3-A) but exercises the payment-side port shape:
 * `JournalEntrySnapshot` DTO flat, NOT the `Journal` aggregate entity.
 *
 * P-4 (TS lie): `JournalEntryLineSnapshot.accountNature` is typed
 * `"DEBIT" | "CREDIT"` (port domain), but the runtime value is Prisma's
 * `DEUDORA | ACREEDORA`. This test mirrors the lie via cast — paridad
 * `LegacyAccountingAdapter.toSnapshot` (line 178). Resolution deferred.
 */

describe("PrismaAccountBalancesAdapter — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let assetAccountId: string;
  let liabilityAccountId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pba-test-clerk-user-${stamp}`,
        email: `pba-test-${stamp}@test.local`,
        name: "PrismaAccountBalancesAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pba-test-clerk-org-${stamp}`,
        name: `PrismaAccountBalancesAdapter Integration Test Org ${stamp}`,
        slug: `pba-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pba-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const asset = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "1000",
        name: "Test Asset",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 1,
        isDetail: true,
      },
    });
    assetAccountId = asset.id;

    const liability = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "2000",
        name: "Test Liability",
        type: "PASIVO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
      },
    });
    liabilityAccountId = liability.id;
  });

  afterEach(async () => {
    await prisma.accountBalance.deleteMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
    });
  });

  afterAll(async () => {
    await prisma.accountBalance.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  // P-4 cast helper: snapshot field is typed DEBIT|CREDIT but runtime carries
  // Prisma's DEUDORA|ACREEDORA. Mirror of `legacy-accounting.adapter.ts:178`.
  function asNature(n: "DEUDORA" | "ACREEDORA"): "DEBIT" | "CREDIT" {
    return n as unknown as "DEBIT" | "CREDIT";
  }

  function buildPostedSnapshot(): JournalEntrySnapshot {
    return {
      id: crypto.randomUUID(),
      organizationId: testOrgId,
      periodId: testPeriodId,
      lines: [
        {
          accountId: assetAccountId,
          debit: 100,
          credit: 0,
          contactId: null,
          accountNature: asNature("DEUDORA"),
        },
        {
          accountId: liabilityAccountId,
          debit: 0,
          credit: 100,
          contactId: null,
          accountNature: asNature("ACREEDORA"),
        },
      ],
    };
  }

  function buildOffsettingSnapshot(amount: number): JournalEntrySnapshot {
    return {
      id: crypto.randomUUID(),
      organizationId: testOrgId,
      periodId: testPeriodId,
      lines: [
        {
          accountId: assetAccountId,
          debit: 0,
          credit: amount,
          contactId: null,
          accountNature: asNature("DEUDORA"),
        },
        {
          accountId: liabilityAccountId,
          debit: amount,
          credit: 0,
          contactId: null,
          accountNature: asNature("ACREEDORA"),
        },
      ],
    };
  }

  it("instantiates and satisfies AccountBalancesPort", () => {
    const adapter: AccountBalancesPort = new PrismaAccountBalancesAdapter();
    expect(adapter).toBeDefined();
  });

  it("applyPostTx: persists one balance row per account with debit/credit deltas matching the line amounts", async () => {
    const snapshot = buildPostedSnapshot();

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaAccountBalancesAdapter();
      await adapter.applyPostTx(tx, snapshot);
    });

    const balances = await prisma.accountBalance.findMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
      orderBy: { account: { code: "asc" } },
    });

    expect(balances.length).toBe(2);

    expect(balances[0].accountId).toBe(assetAccountId);
    expect(balances[0].debitTotal.toString()).toBe("100");
    expect(balances[0].creditTotal.toString()).toBe("0");
    expect(balances[0].balance.toString()).toBe("100");

    expect(balances[1].accountId).toBe(liabilityAccountId);
    expect(balances[1].debitTotal.toString()).toBe("0");
    expect(balances[1].creditTotal.toString()).toBe("100");
    expect(balances[1].balance.toString()).toBe("100");
  });

  it("applyVoidTx: reverses balance increments to zero (post then void)", async () => {
    const snapshot = buildPostedSnapshot();

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaAccountBalancesAdapter();
      await adapter.applyPostTx(tx, snapshot);
    });

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaAccountBalancesAdapter();
      await adapter.applyVoidTx(tx, snapshot);
    });

    const balances = await prisma.accountBalance.findMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
      orderBy: { account: { code: "asc" } },
    });

    expect(balances.length).toBe(2);

    expect(balances[0].accountId).toBe(assetAccountId);
    expect(balances[0].debitTotal.toString()).toBe("0");
    expect(balances[0].creditTotal.toString()).toBe("0");
    expect(balances[0].balance.toString()).toBe("0");

    expect(balances[1].accountId).toBe(liabilityAccountId);
    expect(balances[1].debitTotal.toString()).toBe("0");
    expect(balances[1].creditTotal.toString()).toBe("0");
    expect(balances[1].balance.toString()).toBe("0");
  });

  it("applyPostTx: balance recomputed from nature — DEUDORA = debit - credit, ACREEDORA = credit - debit (characterization)", async () => {
    // Failure mode (feedback/red-acceptance-failure-mode): PASS por
    // caracterización del paso 3 (recálculo balance por nature). Captura el
    // contrato bit-exact con `PrismaAccountBalancesRepo` accounting C5 P2 +
    // legacy `upsert`. Setup discriminante: dos snapshots balanced con
    // direcciones opuestas por cuenta (S1 asset debit / liab credit; S2
    // asset credit / liab debit) → debitTotal Y creditTotal ambos no-cero
    // por cuenta. Sin paso 3, balance queda 0; sin sign por nature,
    // ACREEDORA daría -70 en lugar del esperado 70.

    const s1 = buildPostedSnapshot();
    const s2 = buildOffsettingSnapshot(30);

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaAccountBalancesAdapter();
      await adapter.applyPostTx(tx, s1);
      await adapter.applyPostTx(tx, s2);
    });

    const balances = await prisma.accountBalance.findMany({
      where: { organizationId: testOrgId, periodId: testPeriodId },
      orderBy: { account: { code: "asc" } },
    });

    expect(balances.length).toBe(2);

    // Asset (DEUDORA): debitTotal=100, creditTotal=30 → balance = 100 - 30 = 70
    expect(balances[0].accountId).toBe(assetAccountId);
    expect(balances[0].debitTotal.toString()).toBe("100");
    expect(balances[0].creditTotal.toString()).toBe("30");
    expect(balances[0].balance.toString()).toBe("70");

    // Liability (ACREEDORA): debitTotal=30, creditTotal=100 → balance = 100 - 30 = 70
    expect(balances[1].accountId).toBe(liabilityAccountId);
    expect(balances[1].debitTotal.toString()).toBe("30");
    expect(balances[1].creditTotal.toString()).toBe("100");
    expect(balances[1].balance.toString()).toBe("70");
  });
});
