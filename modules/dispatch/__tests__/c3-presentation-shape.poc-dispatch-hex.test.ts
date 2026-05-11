import { describe, it, expect } from "vitest";

/**
 * C3 RED — Presentation layer shape tests for POC dispatch-hex migration.
 * Validates composition-root, server barrel, index barrel, validation schemas,
 * and HubService co-located inside modules/dispatch.
 */

import {
  makeDispatchService,
} from "../presentation/composition-root";

import {
  DispatchService,
  HubService,
  hubQuerySchema,
} from "../presentation/server";

import {
  createDispatchSchema,
  updateDispatchSchema,
  dispatchFiltersSchema,
} from "../presentation/schemas/dispatch.schemas";

import type {
  HubFilters,
  HubItem,
} from "../presentation/hub.types";

import {
  DispatchHubService,
} from "../presentation/hub.service";

describe("POC dispatch-hex C3 — presentation layer shape", () => {
  it("makeDispatchService factory returns DispatchService instance", () => {
    // This is a composition-root smoke test — will fail at runtime without DB
    // but the import must resolve and the function exist
    expect(typeof makeDispatchService).toBe("function");
  });

  it("server barrel re-exports DispatchService", () => {
    expect(DispatchService).toBeDefined();
  });

  it("server barrel re-exports HubService as DispatchHubService", () => {
    expect(HubService).toBeDefined();
  });

  it("server barrel re-exports hubQuerySchema", () => {
    expect(hubQuerySchema).toBeDefined();
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

  it("hubQuerySchema validates type enum", () => {
    const result = hubQuerySchema.safeParse({
      type: "VENTA_GENERAL",
    });
    expect(result.success).toBe(true);
  });

  it("DispatchHubService class exists", () => {
    expect(typeof DispatchHubService).toBe("function");
  });

  it("hub types compile", () => {
    type _F = HubFilters;
    type _I = HubItem;
    const wired: _F = {};
    expect(wired).toBeDefined();
  });
});
