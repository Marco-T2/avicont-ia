/**
 * Group E — Phase 2 UI grouping (REQ-CORR.5, D3.a, D3.b, D3.c, D5)
 *
 * Tests for:
 *   - E1: groupByCorrelation() helper (unit)
 *   - E2: buildTimelineSummary() helper (unit)
 *   - E3: AuditDetailTimeline component render refactor (5 cases per D5)
 *
 * TDD order: write RED first, implement GREEN, confirm pass.
 *
 * Mocks: next/link passthrough, next/navigation useRouter stub.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AuditEvent } from "@/modules/audit/presentation";

// ── Imports under test ────────────────────────────────────────────────────────
// E1: groupByCorrelation exported from audit-detail-timeline for testing.
// E2: buildTimelineSummary exported from features/audit/audit.types (via index).
// E3: AuditDetailTimeline component.

import {
  groupByCorrelation,
  buildTimelineSummary,
  AuditDetailTimeline,
} from "@/components/audit/audit-detail-timeline";

// ── Mocks ─────────────────────────────────────────────────────────────────────

import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => cleanup());

// ── Fixture helpers ───────────────────────────────────────────────────────────

let _eventCounter = 0;

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  _eventCounter += 1;
  return {
    id: overrides.id ?? `evt_${_eventCounter}`,
    createdAt:
      overrides.createdAt ?? new Date(`2026-04-24T12:0${_eventCounter}:00Z`),
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
    correlationId:
      overrides.correlationId !== undefined ? overrides.correlationId : null,
  };
}

// ── E1: groupByCorrelation unit tests ─────────────────────────────────────────

describe("groupByCorrelation()", () => {
  it("groups 3 events sharing cid_X, 1 null singleton, 2 events sharing cid_Y into 3 groups", () => {
    const a1 = makeEvent({ id: "a1", correlationId: "cid-x" });
    const a2 = makeEvent({ id: "a2", correlationId: "cid-x" });
    const a3 = makeEvent({ id: "a3", correlationId: "cid-x" });
    const n = makeEvent({ id: "n", correlationId: null });
    const b1 = makeEvent({ id: "b1", correlationId: "cid-y" });
    const b2 = makeEvent({ id: "b2", correlationId: "cid-y" });

    const groups = groupByCorrelation([a1, a2, a3, n, b1, b2]);

    expect(groups).toHaveLength(3);
    expect(groups[0].events).toHaveLength(3);
    expect(groups[1].events).toHaveLength(1);
    expect(groups[2].events).toHaveLength(2);
  });

  it("preserves chronological order of first-seen group keys", () => {
    const a1 = makeEvent({ id: "a1", correlationId: "cid-x" });
    const n = makeEvent({ id: "n", correlationId: null });
    const b1 = makeEvent({ id: "b1", correlationId: "cid-y" });
    const b2 = makeEvent({ id: "b2", correlationId: "cid-y" });

    const groups = groupByCorrelation([a1, n, b1, b2]);

    expect(groups[0].correlationId).toBe("cid-x");
    expect(groups[1].correlationId).toBeNull();
    expect(groups[2].correlationId).toBe("cid-y");
  });

  it("null singleton group has a synthetic key matching /__singleton__:/", () => {
    const n = makeEvent({ id: "n_singleton", correlationId: null });

    const groups = groupByCorrelation([n]);

    expect(groups).toHaveLength(1);
    expect(/__singleton__:/.test(groups[0].key)).toBe(true);
    expect(groups[0].correlationId).toBeNull();
  });

  it("non-null correlationId group has key equal to correlationId", () => {
    const ev = makeEvent({ id: "e1", correlationId: "cid-abc" });

    const groups = groupByCorrelation([ev]);

    expect(groups[0].key).toBe("cid-abc");
    expect(groups[0].correlationId).toBe("cid-abc");
  });

  it("empty input returns empty array", () => {
    expect(groupByCorrelation([])).toHaveLength(0);
  });
});

// ── E2: buildTimelineSummary unit tests ───────────────────────────────────────

describe("buildTimelineSummary()", () => {
  it("returns empty string for empty events array", () => {
    expect(buildTimelineSummary([])).toBe("");
  });

  it("describes a single header event as '1 cabecera modificada'", () => {
    const ev = makeEvent({ entityType: "journal_entries", action: "UPDATE" });
    expect(buildTimelineSummary([ev])).toBe("1 cabecera modificada");
  });

  it("1 header + 3 creates + 2 updates → all three parts joined by ' · '", () => {
    const events = [
      makeEvent({ entityType: "journal_entries", action: "UPDATE" }), // header
      makeEvent({ entityType: "journal_lines", action: "CREATE" }),
      makeEvent({ entityType: "journal_lines", action: "CREATE" }),
      makeEvent({ entityType: "journal_lines", action: "CREATE" }),
      makeEvent({ entityType: "journal_lines", action: "UPDATE" }),
      makeEvent({ entityType: "journal_lines", action: "UPDATE" }),
    ];
    const summary = buildTimelineSummary(events);
    expect(summary).toContain("1 cabecera modificada");
    expect(summary).toContain("3 líneas creadas");
    expect(summary).toContain("2 líneas modificadas");
    expect(summary).toBe(
      "1 cabecera modificada · 3 líneas creadas · 2 líneas modificadas",
    );
  });

  it("singular form: '1 línea creada' (not 'creadas')", () => {
    const ev = makeEvent({ entityType: "journal_lines", action: "CREATE" });
    expect(buildTimelineSummary([ev])).toBe("1 línea creada");
  });

  it("all deletes: '5 líneas eliminadas'", () => {
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ entityType: "journal_lines", action: "DELETE" }),
    );
    expect(buildTimelineSummary(events)).toBe("5 líneas eliminadas");
  });

  it("1 delete: '1 línea eliminada' (singular)", () => {
    const ev = makeEvent({ entityType: "journal_lines", action: "DELETE" });
    expect(buildTimelineSummary([ev])).toBe("1 línea eliminada");
  });

  it("1 header + 3 creates + 2 deletes → '1 cabecera modificada · 3 líneas creadas · 2 líneas eliminadas'", () => {
    const events = [
      makeEvent({ entityType: "journal_entries", action: "UPDATE" }),
      makeEvent({ entityType: "journal_lines", action: "CREATE" }),
      makeEvent({ entityType: "journal_lines", action: "CREATE" }),
      makeEvent({ entityType: "journal_lines", action: "CREATE" }),
      makeEvent({ entityType: "journal_lines", action: "DELETE" }),
      makeEvent({ entityType: "journal_lines", action: "DELETE" }),
    ];
    expect(buildTimelineSummary(events)).toBe(
      "1 cabecera modificada · 3 líneas creadas · 2 líneas eliminadas",
    );
  });
});

// ── E3: AuditDetailTimeline render (5 cases per D5) ──────────────────────────

describe("AuditDetailTimeline — correlation grouping (REQ-CORR.5)", () => {
  /**
   * (a) Single event with correlationId !== null
   * — 1 card, no toggle, AuditDiffViewer visible immediately.
   */
  it("(a) single non-null correlationId event: 1 card, no toggle, diff visible", () => {
    const ev = makeEvent({
      id: "e1",
      correlationId: "cid-x",
      entityType: "journal_entries",
      action: "UPDATE",
      oldValues: { status: "DRAFT" },
      newValues: { status: "POSTED" },
    });
    render(<AuditDetailTimeline events={[ev]} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /ver detalle/i })).toBeNull();
    // AuditDiffViewer renders a table with "Campo" header
    expect(screen.getByText("Campo")).toBeInTheDocument();
  });

  /**
   * (b) Multi-event group with shared correlationId
   * — 1 card with toggle, summary visible, AuditDiffViewer hidden initially.
   */
  it("(b) multi-event group (3 events, same correlationId): 1 card with toggle, diff hidden initially", () => {
    const events = [
      makeEvent({
        id: "b1",
        correlationId: "cid-b",
        entityType: "journal_entries",
        action: "UPDATE",
        oldValues: { status: "DRAFT" },
        newValues: { status: "POSTED" },
      }),
      makeEvent({
        id: "b2",
        correlationId: "cid-b",
        entityType: "journal_lines",
        action: "CREATE",
        oldValues: null,
        newValues: { debit: 100 },
      }),
      makeEvent({
        id: "b3",
        correlationId: "cid-b",
        entityType: "journal_lines",
        action: "DELETE",
        oldValues: { debit: 50 },
        newValues: null,
      }),
    ];
    render(<AuditDetailTimeline events={events} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /ver detalle/i }),
    ).toBeInTheDocument();
    // Diff table ("Campo") should NOT be visible before toggle click
    expect(screen.queryByText("Campo")).toBeNull();
    // Click toggle — all 3 diffs should appear
    fireEvent.click(screen.getByRole("button", { name: /ver detalle/i }));
    expect(screen.getAllByText("Campo")).toHaveLength(3);
  });

  /**
   * (c) Single event with correlationId === null (legacy)
   * — identical to (a): 1 card, no toggle, AuditDiffViewer visible.
   */
  it("(c) single null correlationId event (legacy): 1 card, no toggle, diff visible", () => {
    const ev = makeEvent({
      id: "c1",
      correlationId: null,
      entityType: "sales",
      action: "STATUS_CHANGE",
      oldValues: { status: "DRAFT" },
      newValues: { status: "POSTED" },
    });
    render(<AuditDetailTimeline events={[ev]} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /ver detalle/i })).toBeNull();
    expect(screen.getByText("Campo")).toBeInTheDocument();
  });

  /**
   * (d) Mixed comprehensive:
   * 3-event group (cid_X) + 1 NULL singleton + 2-event group (cid_Y)
   * → 3 cards, 2 with "Ver detalle" toggle.
   */
  it("(d) mixed: 3-group + 1 NULL singleton + 2-group renders 3 cards, 2 with toggle", () => {
    const events = [
      makeEvent({
        id: "a1",
        correlationId: "cid-x",
        action: "UPDATE",
        entityType: "journal_entries",
        oldValues: { status: "DRAFT" },
        newValues: { status: "POSTED" },
      }),
      makeEvent({
        id: "a2",
        correlationId: "cid-x",
        action: "DELETE",
        entityType: "journal_lines",
        oldValues: { debit: 10 },
        newValues: null,
      }),
      makeEvent({
        id: "a3",
        correlationId: "cid-x",
        action: "CREATE",
        entityType: "journal_lines",
        oldValues: null,
        newValues: { debit: 20 },
      }),
      makeEvent({
        id: "n",
        correlationId: null,
        action: "UPDATE",
        entityType: "journal_entries",
        oldValues: { status: "DRAFT" },
        newValues: { status: "POSTED" },
      }),
      makeEvent({
        id: "b1",
        correlationId: "cid-y",
        action: "DELETE",
        entityType: "journal_lines",
        oldValues: { debit: 30 },
        newValues: null,
      }),
      makeEvent({
        id: "b2",
        correlationId: "cid-y",
        action: "CREATE",
        entityType: "journal_lines",
        oldValues: null,
        newValues: { debit: 40 },
      }),
    ];
    render(<AuditDetailTimeline events={events} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    // 3-event group (cid_X) and 2-event group (cid_Y) have toggles
    expect(screen.getAllByRole("button", { name: /ver detalle/i })).toHaveLength(
      2,
    );
  });

  /**
   * (e) Empty events
   * — renders the existing "No hay eventos" empty state.
   */
  it("(e) empty events: renders empty state", () => {
    render(<AuditDetailTimeline events={[]} />);
    expect(
      screen.getByText(/no hay eventos de auditoría/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
