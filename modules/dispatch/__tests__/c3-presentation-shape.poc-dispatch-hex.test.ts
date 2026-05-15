import { describe, it, expect } from "vitest";

/**
 * C3 RED — Presentation layer shape tests for POC dispatch-hex migration.
 * Validates composition-root, server barrel, index barrel, validation schemas.
 *
 * RETIRED PORTIONS by poc-dispatch-retirement-into-sales C1 GREEN:
 * - HubService class (DispatchHubService) DELETED
 * - hub.types.ts (HubFilters, HubItem) DELETED
 * - hubQuerySchema (hub.validation.ts) DELETED
 * - server.ts barrel no longer re-exports HubService / hubQuerySchema
 *
 * Non-retired schema tests preserved below; HubService-shape tests SKIP'd
 * atomic with the deletion they assert (cementación invariant superseded
 * per [[invariant_collision_elevation]]).
 */

import {
  makeDispatchService,
} from "../presentation/composition-root";

import {
  DispatchService,
} from "../presentation/server";

import {
  createDispatchSchema,
  updateDispatchSchema,
  dispatchFiltersSchema,
} from "../presentation/schemas/dispatch.schemas";

describe("POC dispatch-hex C3 — presentation layer shape", () => {
  it("makeDispatchService factory returns DispatchService instance", () => {
    // This is a composition-root smoke test — will fail at runtime without DB
    // but the import must resolve and the function exist
    expect(typeof makeDispatchService).toBe("function");
  });

  it("server barrel re-exports DispatchService", () => {
    expect(DispatchService).toBeDefined();
  });

  it.skip("server barrel re-exports HubService as DispatchHubService (RETIRED — C1 deletion)", () => {
    // HubService DELETED in poc-dispatch-retirement-into-sales C1 GREEN.
  });

  it.skip("server barrel re-exports hubQuerySchema (RETIRED — C1 deletion)", () => {
    // hubQuerySchema DELETED with hub.validation.ts in C1 GREEN.
  });

  it("createDispatchSchema validates correct input", () => {
    const result = createDispatchSchema.safeParse({
      dispatchType: "NOTA_DESPACHO",
      date: "2026-05-11",
      contactId: "c-1",
      periodId: "p-1",
      description: "Test dispatch",
      details: [
        {
          description: "Pollo",
          boxes: 5,
          grossWeight: 100,
          unitPrice: 10,
          order: 0,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("createDispatchSchema rejects invalid dispatchType", () => {
    const result = createDispatchSchema.safeParse({
      dispatchType: "INVALID",
      date: "2026-05-11",
      contactId: "c-1",
      periodId: "p-1",
      description: "Test",
      details: [],
    });
    expect(result.success).toBe(false);
  });

  it("updateDispatchSchema allows partial fields", () => {
    const result = updateDispatchSchema.safeParse({
      description: "Updated",
    });
    expect(result.success).toBe(true);
  });

  it("dispatchFiltersSchema accepts optional filters", () => {
    const result = dispatchFiltersSchema.safeParse({
      status: "DRAFT",
    });
    expect(result.success).toBe(true);
  });

  it.skip("hubQuerySchema validates type enum (RETIRED — C1 deletion)", () => {
    // hubQuerySchema DELETED with hub.validation.ts in C1 GREEN.
  });

  it.skip("DispatchHubService class exists (RETIRED — C1 deletion)", () => {
    // DispatchHubService class DELETED in C1 GREEN.
  });

  it.skip("hub types compile (RETIRED — C1 deletion)", () => {
    // HubFilters + HubItem types DELETED with hub.types.ts in C1 GREEN.
  });
});
