import { describe, expect, it } from "vitest";

import type { OrgSettingsReaderPort } from "../domain/ports/org-settings-reader.port";
import type {
  SalePermissionScope,
  SalePermissionsPort,
} from "../domain/ports/sale-permissions.port";
import type { SaleRepository } from "../domain/ports/sale.repository";
import type { SaleScope, SaleUnitOfWork } from "../application/sale-unit-of-work";

/**
 * Compile-time structural test: forces the type-checker to load every A2 seed
 * port + UoW interface so TS errors surface here instead of in Ciclo 2 when
 * fakes start implementing the contracts.
 *
 * IvaBookReaderPort / IvaBookRegenNotifierPort / IvaBookVoidCascadePort retired
 * in lcv-feature-retirement (RND 102100000011 Dec-2021).
 */
describe("POC #11.0a A2 Ciclo 1 — seed structure", () => {
  it("the sale 'sales' permission scope is the only allowed value", () => {
    const scope: SalePermissionScope = "sales";
    expect(scope).toBe("sales");
  });

  it("port surface is wired into SaleScope", () => {
    type Surface = keyof SaleScope;
    const wired: Record<Surface, true> = {
      correlationId: true,
      fiscalPeriods: true,
      sales: true,
      journalEntries: true,
      accountBalances: true,
      receivables: true,
      journalEntryFactory: true,
    };
    expect(Object.keys(wired)).toHaveLength(7);
  });

  it("standalone read ports stay outside the SaleScope", () => {
    type StandaloneSurface = "getOrCreate" | "canPost";
    const _readers: Record<
      StandaloneSurface,
      keyof OrgSettingsReaderPort | keyof SalePermissionsPort
    > = {
      getOrCreate: "getOrCreate",
      canPost: "canPost",
    };
    expect(Object.values(_readers)).toEqual([
      "getOrCreate",
      "canPost",
    ]);
  });

  it("unused type imports keep the symbols live in the build graph", () => {
    type Wired =
      | SaleRepository
      | SaleUnitOfWork;
    const _holder: Wired | null = null;
    expect(_holder).toBeNull();
  });
});
