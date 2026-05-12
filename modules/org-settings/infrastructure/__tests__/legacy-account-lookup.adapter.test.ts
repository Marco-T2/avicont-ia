/**
 * Tests del LegacyAccountLookupAdapter — verifican que el mapeo Prisma Account
 * → AccountReference (DTO local) NO filtra el modelo de accounting al dominio
 * de org-settings. Si AccountsRepository.findManyByIds devuelve campos extra
 * (parentId, type, subtype, organizationId, etc.), el adapter los descarta.
 *
 * Riesgo real de regresión: el día que accounting migre al patrón hexagonal,
 * estos tests deben seguir verde con el nuevo adapter envuelto en su lugar.
 */

import { describe, it, expect, vi } from "vitest";
import { LegacyAccountLookupAdapter } from "../legacy-account-lookup.adapter";
import type { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import type { Account } from "@/generated/prisma/client";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    code: "1.1.1.1",
    name: "Caja General",
    type: "ACTIVO",
    nature: "DEUDORA",
    subtype: "ACTIVO_CORRIENTE",
    parentId: "parent-cash",
    level: 4,
    isDetail: true,
    requiresContact: false,
    description: null,
    isActive: true,
    isContraAccount: false,
    organizationId: "org-1",
    ...overrides,
  };
}

describe("LegacyAccountLookupAdapter", () => {
  it("delega en AccountsRepository.findManyByIds con (orgId, ids)", async () => {
    const repo = {
      findManyByIds: vi.fn(async () => [makeAccount({ id: "acc-1" })]),
    } as unknown as PrismaAccountsRepo;
    const adapter = new LegacyAccountLookupAdapter(repo);

    await adapter.findManyByIds("org-1", ["acc-1", "acc-2"]);

    expect(repo.findManyByIds).toHaveBeenCalledExactlyOnceWith(
      "org-1",
      ["acc-1", "acc-2"],
    );
  });

  it("mapea Account row → AccountReference exponiendo solo { id, code, isDetail, isActive }", async () => {
    const repo = {
      findManyByIds: vi.fn(async () => [
        makeAccount({
          id: "acc-1",
          code: "1.1.1.1",
          isDetail: true,
          isActive: true,
          parentId: "parent-cash",
          name: "Caja General",
          type: "ACTIVO",
        }),
      ]),
    } as unknown as PrismaAccountsRepo;
    const adapter = new LegacyAccountLookupAdapter(repo);

    const result = await adapter.findManyByIds("org-1", ["acc-1"]);

    expect(result).toEqual([
      { id: "acc-1", code: "1.1.1.1", isDetail: true, isActive: true },
    ]);
    // No deben filtrarse otros campos (parentId, type, name, organizationId, etc.).
    expect(result[0]).not.toHaveProperty("parentId");
    expect(result[0]).not.toHaveProperty("name");
    expect(result[0]).not.toHaveProperty("type");
    expect(result[0]).not.toHaveProperty("organizationId");
  });

  it("preserva isDetail=false y isActive=false en el mapeo (sin defaults)", async () => {
    const repo = {
      findManyByIds: vi.fn(async () => [
        makeAccount({ id: "acc-1", isDetail: false, isActive: false }),
      ]),
    } as unknown as PrismaAccountsRepo;
    const adapter = new LegacyAccountLookupAdapter(repo);

    const [ref] = await adapter.findManyByIds("org-1", ["acc-1"]);
    expect(ref.isDetail).toBe(false);
    expect(ref.isActive).toBe(false);
  });

  it("devuelve array vacío cuando AccountsRepository no encuentra ninguna cuenta", async () => {
    const repo = {
      findManyByIds: vi.fn(async () => []),
    } as unknown as PrismaAccountsRepo;
    const adapter = new LegacyAccountLookupAdapter(repo);

    const result = await adapter.findManyByIds("org-1", ["acc-missing"]);
    expect(result).toEqual([]);
  });

  it("preserva el orden de las cuentas devueltas por el repo", async () => {
    const repo = {
      findManyByIds: vi.fn(async () => [
        makeAccount({ id: "acc-3" }),
        makeAccount({ id: "acc-1" }),
        makeAccount({ id: "acc-2" }),
      ]),
    } as unknown as PrismaAccountsRepo;
    const adapter = new LegacyAccountLookupAdapter(repo);

    const result = await adapter.findManyByIds("org-1", ["acc-1", "acc-2", "acc-3"]);
    expect(result.map((a) => a.id)).toEqual(["acc-3", "acc-1", "acc-2"]);
  });
});
