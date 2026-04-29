import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { OrgSettingsService } from "@/modules/org-settings/application/org-settings.service";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { PrismaOrgSettingsRepository } from "@/modules/org-settings/infrastructure/prisma-org-settings.repository";

import { PrismaOrgSettingsReaderAdapter } from "../prisma-org-settings-reader.adapter";

/**
 * Postgres-real integration test for PrismaOrgSettingsReaderAdapter
 * (POC #11.0a A3 Ciclo 2). Same baseline pattern as POC #10 C3-A
 * `prisma-account-balances.repo.integration.test.ts` MINUS paso 3 audit_logs:
 * grep pre-RED verified NO trigger exists on `org_settings`, `organizations`
 * or `users`. Triggers attach only to dispatches/payments/journal_entries/
 * journal_lines/sales/sale_details/purchases/purchase_details/fiscal_periods.
 * Audit cleanup deferred to Ciclo 3 (PrismaSaleRepository — `sales` triggers).
 *
 * Fixtures (`beforeAll`): Organization only. NO User row needed (`org_settings`
 * has no createdById/updatedById columns). NO Period/Accounts (getOrCreate
 * doesn't read accounts — accountLookup is a constructor dep of the wrapped
 * service, exercised only by `update`).
 *
 * Wiring (D-OS#1 lockeada 3-α + 1.c real):
 *   PrismaOrgSettingsReaderAdapter
 *     └─ OrgSettingsService
 *          ├─ PrismaOrgSettingsRepository  (real, dev DB via @/lib/prisma)
 *          └─ LegacyAccountLookupAdapter   (real — no test↔composition-root drift)
 */

describe("PrismaOrgSettingsReaderAdapter — Postgres integration", () => {
  let testOrgId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `posra-test-clerk-org-${stamp}`,
        name: `PrismaOrgSettingsReaderAdapter Integration Test Org ${stamp}`,
        slug: `posra-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;
  });

  afterAll(async () => {
    // FK-safe: org_settings.organizationId → organizations(id) ON DELETE RESTRICT.
    // No audit_logs cleanup needed — pre-RED grep confirmed no triggers on
    // org_settings/organizations/users (POC #11.0a A3 Ciclo 2 D-4.b).
    await prisma.orgSettings.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
  });

  function buildAdapter(): PrismaOrgSettingsReaderAdapter {
    return new PrismaOrgSettingsReaderAdapter(
      new OrgSettingsService(
        new PrismaOrgSettingsRepository(),
        new LegacyAccountLookupAdapter(),
      ),
    );
  }

  it("getOrCreate: returns existing settings when row already exists for orgId (read-existing branch)", async () => {
    // RED honesty preventivo (feedback/red-acceptance-failure-mode):
    // FAILS pre-implementación por module resolution failure
    // (`PrismaOrgSettingsReaderAdapter` no existe). Post-GREEN: PASSES porque
    // adapter delega a service.getOrCreate, que detecta la fila pre-cargada
    // con valores discriminantes y retorna sin crear nada nuevo.
    //
    // Setup discriminante: pre-insert con cxcAccountCode="9.9.9.9" y
    // roundingThreshold=0.3 (ambos fuera de los defaults — 1.1.4.1 / 0.7).
    // Si el adapter erróneamente disparara el branch create-default, los
    // asserts detectarían los valores DEFAULT y fallarían.

    await prisma.orgSettings.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: testOrgId,
        cajaGeneralAccountCode: "1.1.1.1",
        bancoAccountCode: "1.1.2.1",
        cxcAccountCode: "9.9.9.9", // discriminante (default = 1.1.4.1)
        cxpAccountCode: "2.1.1.1",
        roundingThreshold: 0.3,    // discriminante (default = 0.7)
        cashParentCode: "1.1.1",
        pettyCashParentCode: "1.1.2",
        bankParentCode: "1.1.3",
        fleteExpenseAccountCode: "5.1.3",
        polloFaenadoCOGSAccountCode: "5.1.1",
        itExpenseAccountCode: "5.3.3",
        itPayableAccountCode: "2.1.7",
        defaultCashAccountIds: [],
        defaultBankAccountIds: [],
      },
    });

    const adapter = buildAdapter();

    const result = await adapter.getOrCreate(testOrgId);
    const snap = result.toSnapshot();

    expect(snap.organizationId).toBe(testOrgId);
    expect(snap.cxcAccountCode).toBe("9.9.9.9"); // discriminante
    expect(snap.roundingThreshold).toBe(0.3);    // discriminante

    // Read branch did NOT trigger save — no duplicate row.
    const count = await prisma.orgSettings.count({
      where: { organizationId: testOrgId },
    });
    expect(count).toBe(1);

    // Cleanup so test 2 starts clean.
    await prisma.orgSettings.deleteMany({ where: { organizationId: testOrgId } });
  });

  it("getOrCreate: creates default settings when no row exists for orgId (create-default branch)", async () => {
    // RED honesty preventivo: FAILS pre-implementación por module resolution
    // failure. Post-GREEN: PASSES porque service.getOrCreate ejecuta el branch
    // findByOrgId→null → OrgSettings.createDefault → repo.save (real Prisma
    // INSERT contra dev DB). Adapter retorna la entity fresca.
    //
    // Setup: org existe (beforeAll) sin org_settings row (test 1 limpió).

    const result = await buildAdapter().getOrCreate(testOrgId);
    const snap = result.toSnapshot();

    expect(snap.organizationId).toBe(testOrgId);
    expect(snap.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Spot-checks defaults (org-settings.entity.ts:92-104).
    expect(snap.cajaGeneralAccountCode).toBe("1.1.1.1");
    expect(snap.bankParentCode).toBe("1.1.3");
    expect(snap.roundingThreshold).toBe(0.7);
    expect(snap.defaultCashAccountIds).toEqual([]);

    // Row persisted to DB (real INSERT, not just in-memory).
    const persisted = await prisma.orgSettings.findUnique({
      where: { organizationId: testOrgId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.cxcAccountCode).toBe("1.1.4.1"); // default
    expect(Number(persisted!.roundingThreshold)).toBe(0.7);
  });
});
