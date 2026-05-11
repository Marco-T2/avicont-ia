/**
 * Phase 2 — RTL RED suite (REQ-AUDIT.11, A11-S1..A11-S5)
 *
 * Estos tests DEBEN FALLAR intencionalmente — el componente aún renderiza
 * ítems planos, no operation cards. La fase GREEN (Phase 3) refactoriza
 * AuditEventList para que los 5 tests pasen.
 *
 * Failure modes declarados (project rule):
 *   - A11-S1: TestingLibraryElementError — "Unable to find role: article"
 *             (el componente no usa <article> ni role="article")
 *   - A11-S2: TestingLibraryElementError — "Unable to find an element by:
 *             [data-testid='header-section']"
 *   - A11-S3: TestingLibraryElementError — "Unable to find an element with
 *             the text: /2.*eliminadas/i"
 *   - A11-S4: TestingLibraryElementError — "Unable to find an accessible
 *             element with the role 'link' and name matching /ver.*comprobante/i"
 *   - A11-S5: El componente actual construye la URL con parentVoucherId
 *             undefined (lanza TypeError o renderiza un link), por lo que
 *             queryByRole('link', { name: /ver.*comprobante/i }) !== null
 *             — falla la segunda aserción.
 *
 * Mocks: 2 (next/link passthrough, next/navigation useRouter stub).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AuditEvent, AuditGroup } from "@/modules/audit/presentation";
import { AuditEventList } from "@/components/audit/audit-event-list";

// ── Mocks (≤3 — project rule) ──────────────────────────────────────────────────

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

// ── Helpers de fixture ─────────────────────────────────────────────────────────

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

/** Props mínimas requeridas por AuditEventList (sin filtros activos). */
function renderList(groups: AuditGroup[], orgSlug = "org") {
  return render(
    <AuditEventList
      orgSlug={orgSlug}
      initialData={{ groups, nextCursor: null }}
      filters={{
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      }}
      users={[]}
    />,
  );
}

// ── Suite REQ-AUDIT.11 ────────────────────────────────────────────────────────

describe("AuditEventList — operation card render (REQ-AUDIT.11)", () => {
  /**
   * A11-S1 — Una card por grupo (no N filas atómicas).
   *
   * Failure mode esperado: TestingLibraryElementError —
   * "Unable to find role: article" porque el componente actual renderiza
   * divs planos sin role="article".
   */
  it("A11-S1: renderiza una sola card por grupo (no N filas)", () => {
    const group = makeGroup({
      parentVoucherType: "journal_entries",
      parentVoucherId: "je_001",
      eventCount: 4,
      events: [
        makeEvent({
          id: "e0",
          entityType: "journal_entries",
          action: "UPDATE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_001",
        }),
        makeEvent({
          id: "e1",
          entityType: "journal_lines",
          action: "DELETE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_001",
        }),
        makeEvent({
          id: "e2",
          entityType: "journal_lines",
          action: "DELETE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_001",
        }),
        makeEvent({
          id: "e3",
          entityType: "journal_lines",
          action: "CREATE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_001",
        }),
      ],
    });

    renderList([group]);

    // Exactamente UNA card semántica — no 4 ítems.
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  /**
   * A11-S2 — Distinción header-section / detail-section.
   *
   * Failure mode esperado: TestingLibraryElementError —
   * "Unable to find an element by: [data-testid='header-section']"
   * porque el componente actual no tiene secciones diferenciadas.
   */
  it("A11-S2: distingue header-section de detail-section por entityType", () => {
    const group = makeGroup({
      parentVoucherType: "sales",
      parentVoucherId: "sale_001",
      eventCount: 3,
      events: [
        makeEvent({
          id: "e0",
          entityType: "sales",
          action: "UPDATE",
          parentVoucherType: "sales",
          parentVoucherId: "sale_001",
        }),
        makeEvent({
          id: "e1",
          entityType: "sale_details",
          action: "CREATE",
          parentVoucherType: "sales",
          parentVoucherId: "sale_001",
        }),
        makeEvent({
          id: "e2",
          entityType: "sale_details",
          action: "CREATE",
          parentVoucherType: "sales",
          parentVoucherId: "sale_001",
        }),
      ],
    });

    renderList([group]);

    // Sección de cabecera visible.
    expect(screen.getByTestId("header-section")).toBeInTheDocument();
    // Sección de detalle visible (hay 2 sale_details CREATE).
    expect(screen.queryByTestId("detail-section")).not.toBeNull();
  });

  /**
   * A11-S3 — Resumen agregado de líneas (contador, no filas individuales).
   *
   * Failure mode esperado: TestingLibraryElementError —
   * "Unable to find an element with the text: /2.*eliminadas/i"
   * porque el componente actual renderiza filas planas sin texto de resumen.
   */
  it("A11-S3: muestra contador agregado de líneas (no filas atómicas)", () => {
    const group = makeGroup({
      parentVoucherType: "journal_entries",
      parentVoucherId: "je_002",
      eventCount: 3,
      events: [
        makeEvent({
          id: "e1",
          entityType: "journal_lines",
          action: "DELETE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_002",
        }),
        makeEvent({
          id: "e2",
          entityType: "journal_lines",
          action: "DELETE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_002",
        }),
        makeEvent({
          id: "e3",
          entityType: "journal_lines",
          action: "CREATE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_002",
        }),
      ],
    });

    renderList([group]);

    // Texto de resumen agregado — no filas individuales.
    expect(screen.getByText(/2.*eliminadas/i)).toBeInTheDocument();
    expect(screen.getByText(/1.*creada/i)).toBeInTheDocument();
    // Cero filas individuales de detalle.
    expect(screen.queryAllByTestId("detail-event-row")).toHaveLength(0);
  });

  /**
   * A11-S4 — CTA al detail del comprobante.
   *
   * Failure mode esperado: TestingLibraryElementError —
   * "Unable to find an accessible element with the role 'link'
   *  and name matching /ver.*comprobante/i"
   * porque el componente actual usa un link de auditoría genérico, no
   * un CTA etiquetado "Ver comprobante".
   */
  it("A11-S4: incluye CTA al detail del comprobante", () => {
    const group = makeGroup({
      parentVoucherType: "journal_entries",
      parentVoucherId: "je_001",
      eventCount: 1,
      events: [
        makeEvent({
          id: "e0",
          entityType: "journal_entries",
          action: "UPDATE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_001",
        }),
      ],
    });

    renderList([group], "org");

    const cta = screen.getByRole("link", { name: /ver.*comprobante/i });
    expect(cta).toBeInTheDocument();
    // El href debe apuntar al detail del asiento contable.
    expect(cta.getAttribute("href")).toContain("/accounting/journal/je_001");
  });

  /**
   * A11-S6 — CTA secundaria al timeline de auditoría completa.
   *
   * Failure mode esperado: TestingLibraryElementError —
   * "Unable to find an accessible element with the role 'link'
   *  and name matching /ver.*auditor[ií]a/i"
   * porque el componente actual no expone link a la página
   * `/{orgSlug}/audit/{entityType}/{entityId}` (huérfana hasta este cambio).
   */
  it("A11-S6: incluye CTA al timeline completo de auditoría", () => {
    const group = makeGroup({
      parentVoucherType: "journal_entries",
      parentVoucherId: "je_007",
      eventCount: 9,
      events: [
        makeEvent({
          id: "e0",
          entityType: "journal_entries",
          action: "UPDATE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "je_007",
        }),
      ],
    });

    renderList([group], "acme");

    const auditLink = screen.getByRole("link", { name: /ver.*auditor[ií]a/i });
    expect(auditLink).toBeInTheDocument();
    expect(auditLink.getAttribute("href")).toBe(
      "/acme/audit/journal_entries/je_007",
    );
  });

  /**
   * A11-S5 — Card minimalista sin CTA cuando el grupo es huérfano.
   *
   * Failure mode esperado: TestingLibraryElementError —
   * "Unable to find an element by: [data-testid='orphan-card']"
   * porque el componente actual no distingue grupos huérfanos de no-huérfanos
   * y no renderiza ningún elemento con ese testid.
   */
  it("A11-S5: card minimalista sin CTA cuando es huérfano", () => {
    // parentVoucherId vacío → grupo huérfano (isOrphan === true).
    const group: AuditGroup = {
      parentVoucherType: "journal_entries",
      parentVoucherId: "",
      parentClassification: "directa",
      lastActivityAt: new Date("2026-04-24T12:00:00Z"),
      eventCount: 1,
      events: [
        makeEvent({
          id: "e0",
          entityType: "journal_entries",
          action: "UPDATE",
          parentVoucherType: "journal_entries",
          parentVoucherId: "",
        }),
      ],
    };

    // No debe lanzar error en render.
    expect(() => renderList([group])).not.toThrow();

    // La card huérfana debe identificarse con data-testid="orphan-card".
    // El componente actual no renderiza este testid — falla intencionalmente.
    expect(screen.getByTestId("orphan-card")).toBeInTheDocument();

    // No debe haber CTA al comprobante.
    expect(
      screen.queryByRole("link", { name: /ver.*comprobante/i }),
    ).toBeNull();

    // Tampoco CTA a la auditoría — sin parentVoucherId no hay timeline válido.
    expect(
      screen.queryByRole("link", { name: /ver.*auditor[ií]a/i }),
    ).toBeNull();
  });
});
