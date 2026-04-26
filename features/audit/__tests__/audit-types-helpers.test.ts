/**
 * Phase 1 — Pure helpers unit tests (REQ-AUDIT.11)
 *
 * Cycle 1.1 → 1.6: tests para isHeaderEvent, buildGroupSummary y getVoucherDetailUrl.
 *
 * Failure modes declarados (project rule):
 *   - 1.1 RED: ImportError — "does not provide an export named 'isHeaderEvent'"
 *   - 1.3 RED: ImportError — "does not provide an export named 'buildGroupSummary'"
 *   - 1.5 RED: ImportError — "does not provide an export named 'getVoucherDetailUrl'"
 *
 * 0 mocks (pure functions — no I/O, no external deps).
 */
import { describe, it, expect } from "vitest";
import type { AuditEvent, AuditGroup } from "@/features/audit";
import {
  isHeaderEvent,
  buildGroupSummary,
  getVoucherDetailUrl,
} from "@/features/audit";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: overrides.id ?? "audit_1",
    createdAt: overrides.createdAt ?? new Date("2026-04-24T12:00:00Z"),
    entityType: overrides.entityType ?? "journal_entries",
    entityId: overrides.entityId ?? "je_001",
    action: overrides.action ?? "UPDATE",
    classification: overrides.classification ?? "directa",
    changedBy: overrides.changedBy ?? { id: "u1", name: "Alice" },
    justification: overrides.justification ?? null,
    parentVoucherType: overrides.parentVoucherType ?? "journal_entries",
    parentVoucherId: overrides.parentVoucherId ?? "je_001",
    parentSourceType: overrides.parentSourceType ?? null,
    oldValues: overrides.oldValues ?? null,
    newValues: overrides.newValues ?? null,
    correlationId: overrides.correlationId ?? null,
  };
}

function makeGroup(overrides: Partial<AuditGroup> = {}): AuditGroup {
  return {
    parentVoucherType: overrides.parentVoucherType ?? "journal_entries",
    parentVoucherId: overrides.parentVoucherId ?? "je_001",
    parentClassification: overrides.parentClassification ?? "directa",
    lastActivityAt: overrides.lastActivityAt ?? new Date("2026-04-24T12:00:00Z"),
    eventCount: overrides.eventCount ?? 1,
    events: overrides.events ?? [],
  };
}

// ── isHeaderEvent (Tasks 1.1 → 1.2) ─────────────────────────────────────────

describe("isHeaderEvent — header entity types (5 afirmativos)", () => {
  it("journal_entries → true", () => {
    expect(isHeaderEvent("journal_entries")).toBe(true);
  });

  it("sales → true", () => {
    expect(isHeaderEvent("sales")).toBe(true);
  });

  it("purchases → true", () => {
    expect(isHeaderEvent("purchases")).toBe(true);
  });

  it("payments → true", () => {
    expect(isHeaderEvent("payments")).toBe(true);
  });

  it("dispatches → true", () => {
    expect(isHeaderEvent("dispatches")).toBe(true);
  });
});

describe("isHeaderEvent — detail entity types (3 negativos)", () => {
  it("journal_lines → false", () => {
    expect(isHeaderEvent("journal_lines")).toBe(false);
  });

  it("sale_details → false", () => {
    expect(isHeaderEvent("sale_details")).toBe(false);
  });

  it("purchase_details → false", () => {
    expect(isHeaderEvent("purchase_details")).toBe(false);
  });
});

// ── buildGroupSummary (Tasks 1.3 → 1.4) ──────────────────────────────────────

describe("buildGroupSummary — Fixture A: solo cabecera", () => {
  it("headerEvent != null, detailTotal === 0, isOrphan === false", () => {
    const group = makeGroup({
      parentVoucherId: "je_001",
      events: [makeEvent({ entityType: "journal_entries", action: "UPDATE" })],
    });

    const summary = buildGroupSummary(group);

    expect(summary.headerEvent).not.toBeNull();
    expect(summary.headerEvent?.entityType).toBe("journal_entries");
    expect(summary.detailTotal).toBe(0);
    expect(summary.detailCounts.created).toBe(0);
    expect(summary.detailCounts.updated).toBe(0);
    expect(summary.detailCounts.deleted).toBe(0);
    expect(summary.isOrphan).toBe(false);
  });
});

describe("buildGroupSummary — Fixture B: solo detalle", () => {
  it("headerEvent === null, detailCounts.created === 3, detailTotal === 3", () => {
    const group = makeGroup({
      parentVoucherId: "je_001",
      events: [
        makeEvent({ entityType: "journal_lines", action: "CREATE", id: "e1" }),
        makeEvent({ entityType: "journal_lines", action: "CREATE", id: "e2" }),
        makeEvent({ entityType: "journal_lines", action: "CREATE", id: "e3" }),
      ],
    });

    const summary = buildGroupSummary(group);

    expect(summary.headerEvent).toBeNull();
    expect(summary.detailCounts.created).toBe(3);
    expect(summary.detailCounts.deleted).toBe(0);
    expect(summary.detailCounts.updated).toBe(0);
    expect(summary.detailTotal).toBe(3);
    expect(summary.isOrphan).toBe(false);
  });
});

describe("buildGroupSummary — Fixture C: mix cabecera + detalle", () => {
  it("detailCounts.deleted === 2, detailCounts.created === 3, detailTotal === 5", () => {
    const group = makeGroup({
      parentVoucherId: "je_001",
      events: [
        makeEvent({ entityType: "journal_entries", action: "UPDATE", id: "e0" }),
        makeEvent({ entityType: "journal_lines", action: "DELETE", id: "e1" }),
        makeEvent({ entityType: "journal_lines", action: "DELETE", id: "e2" }),
        makeEvent({ entityType: "journal_lines", action: "CREATE", id: "e3" }),
        makeEvent({ entityType: "journal_lines", action: "CREATE", id: "e4" }),
        makeEvent({ entityType: "journal_lines", action: "CREATE", id: "e5" }),
      ],
    });

    const summary = buildGroupSummary(group);

    expect(summary.headerEvent).not.toBeNull();
    expect(summary.detailCounts.deleted).toBe(2);
    expect(summary.detailCounts.created).toBe(3);
    expect(summary.detailCounts.updated).toBe(0);
    expect(summary.detailTotal).toBe(5);
    expect(summary.isOrphan).toBe(false);
  });
});

describe("buildGroupSummary — Fixture D: grupo vacío (orphan)", () => {
  it("headerEvent === null, detailTotal === 0, isOrphan === true", () => {
    // Sin parentVoucherId → grupo huérfano
    const group: AuditGroup = {
      parentVoucherType: "journal_entries",
      parentVoucherId: "",
      parentClassification: "directa",
      lastActivityAt: new Date("2026-04-24T12:00:00Z"),
      eventCount: 0,
      events: [],
    };

    const summary = buildGroupSummary(group);

    expect(summary.headerEvent).toBeNull();
    expect(summary.detailTotal).toBe(0);
    expect(summary.isOrphan).toBe(true);
  });
});

// ── getVoucherDetailUrl (Tasks 1.5 → 1.6) ────────────────────────────────────

describe("getVoucherDetailUrl — 5 voucher types", () => {
  it("journal_entries → /{orgSlug}/accounting/journal/{id}", () => {
    expect(getVoucherDetailUrl("org", "journal_entries", "je_001")).toBe(
      "/org/accounting/journal/je_001",
    );
  });

  it("sales → /{orgSlug}/sales/{id}", () => {
    expect(getVoucherDetailUrl("org", "sales", "sale_001")).toBe(
      "/org/sales/sale_001",
    );
  });

  it("purchases → /{orgSlug}/purchases/{id}", () => {
    expect(getVoucherDetailUrl("org", "purchases", "pur_001")).toBe(
      "/org/purchases/pur_001",
    );
  });

  it("payments → /{orgSlug}/payments/{id}", () => {
    expect(getVoucherDetailUrl("org", "payments", "pay_001")).toBe(
      "/org/payments/pay_001",
    );
  });

  it("dispatches → /{orgSlug}/dispatches/{id}", () => {
    expect(getVoucherDetailUrl("org", "dispatches", "dis_001")).toBe(
      "/org/dispatches/dis_001",
    );
  });
});

describe("getVoucherDetailUrl — 3 detail types → null (defensivo)", () => {
  it("journal_lines → null", () => {
    expect(getVoucherDetailUrl("org", "journal_lines", "jl_001")).toBeNull();
  });

  it("sale_details → null", () => {
    expect(getVoucherDetailUrl("org", "sale_details", "sd_001")).toBeNull();
  });

  it("purchase_details → null", () => {
    expect(getVoucherDetailUrl("org", "purchase_details", "pd_001")).toBeNull();
  });
});
