/**
 * Audit F #1 RED — OrganizationsService.syncOrganization transaction boundary
 *
 * Covers the CRITICAL finding from Audit F (2026-04-23 scan): syncOrganization
 * performs 4 sequential writes (org + member + voucher types + system roles)
 * with no `$transaction` wrapper. Mid-sequence failure leaves orphan orgs
 * with partial initialization — invoice creation then fails because voucher
 * types or system roles are missing.
 *
 * Expected failure mode on current (pre-fix) code:
 *   - `repo.transaction` is never invoked (0 calls; assertion expects 1)
 *   - `repo.create` / `repo.addMember` / `voucherTypesService.seedForOrg`
 *     are called with 1 arg instead of 2 (missing tx client)
 *   - `prisma.customRole.createMany` is called directly instead of via tx,
 *     so `txClient.customRole.createMany` has 0 calls
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customRole: {
      createMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
  },
}));

import { OrganizationsService } from "../organizations.service";

describe("OrganizationsService.syncOrganization — transaction boundary (Audit F #1)", () => {
  const INPUT = { clerkOrgId: "clerk_org_new", name: "New Org" };
  const CLERK_USER_ID = "user_clerk_new";
  const CREATED_ORG = {
    id: "org_new",
    name: INPUT.name,
    clerkOrgId: INPUT.clerkOrgId,
  };
  const CREATED_USER = { id: "user_db_new", clerkUserId: CLERK_USER_ID };

  function buildService() {
    const txClient = {
      customRole: {
        createMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
    };

    const repo = {
      findByClerkId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(CREATED_ORG),
      addMember: vi.fn().mockResolvedValue({ id: "member_new" }),
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb(txClient),
        ),
    } as unknown as NonNullable<ConstructorParameters<typeof OrganizationsService>[0]>;

    const voucherTypesService = {
      seedForOrg: vi.fn().mockResolvedValue([]),
    } as unknown as NonNullable<ConstructorParameters<typeof OrganizationsService>[1]>;

    const usersService = {
      findOrCreate: vi.fn().mockResolvedValue(CREATED_USER),
    } as unknown as NonNullable<ConstructorParameters<typeof OrganizationsService>[2]>;

    const accountsService = {
      seedChartOfAccounts: vi.fn().mockResolvedValue(undefined),
    } as unknown as NonNullable<ConstructorParameters<typeof OrganizationsService>[3]>;

    return {
      service: new OrganizationsService(
        repo,
        voucherTypesService,
        usersService,
        accountsService,
      ),
      repo,
      voucherTypesService,
      usersService,
      accountsService,
      txClient,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("F-1-S1 — wraps initialization writes in a single repo.transaction() call", async () => {
    const { service, repo } = buildService();

    await service.syncOrganization(INPUT, CLERK_USER_ID);

    expect(repo.transaction).toHaveBeenCalledTimes(1);
  });

  it("F-1-S2 — repo.create receives the tx client from the transaction callback", async () => {
    const { service, repo, txClient } = buildService();

    await service.syncOrganization(INPUT, CLERK_USER_ID);

    expect(repo.create).toHaveBeenCalledWith(INPUT, txClient);
  });

  it("F-1-S3 — repo.addMember receives the tx client from the transaction callback", async () => {
    const { service, repo, txClient } = buildService();

    await service.syncOrganization(INPUT, CLERK_USER_ID);

    expect(repo.addMember).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CREATED_USER.id,
        organizationId: CREATED_ORG.id,
        role: "owner",
      }),
      txClient,
    );
  });

  it("F-1-S4 — voucherTypesService.seedForOrg receives the tx client from the transaction callback", async () => {
    const { service, voucherTypesService, txClient } = buildService();

    await service.syncOrganization(INPUT, CLERK_USER_ID);

    expect(voucherTypesService.seedForOrg).toHaveBeenCalledWith(
      CREATED_ORG.id,
      txClient,
    );
  });

  it("F-1-S5 — customRole.createMany is issued through the tx client, not the top-level prisma client", async () => {
    const { service, txClient } = buildService();
    const { prisma } = await import("@/lib/prisma");

    await service.syncOrganization(INPUT, CLERK_USER_ID);

    expect(txClient.customRole.createMany).toHaveBeenCalledTimes(1);
    expect(
      (prisma.customRole.createMany as unknown as ReturnType<typeof vi.fn>),
    ).not.toHaveBeenCalled();
  });

  it("F-1-S6 — accountsService.seedChartOfAccounts receives the tx client from the transaction callback", async () => {
    const { service, accountsService, txClient } = buildService();

    await service.syncOrganization(INPUT, CLERK_USER_ID);

    expect(accountsService.seedChartOfAccounts).toHaveBeenCalledWith(
      CREATED_ORG.id,
      txClient,
    );
  });
});
