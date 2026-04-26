/**
 * Tests de integración del action confirm con suggestion.action='createJournalEntry'.
 *
 * Cubre:
 *   - Happy path: 201 + journalService.createEntry invocado con sourceType='ai'
 *     + aiOriginalText desde la suggestion.
 *   - RBAC: requirePermission('journal','write') denegado → 403.
 *   - Período inexistente: fiscalPeriodsService.findByDate → null → 422.
 *   - Período cerrado: journalService tira FISCAL_PERIOD_CLOSED → 422 con code.
 *   - Cuadre roto: journalService tira JOURNAL_NOT_BALANCED → 422 (defensa en
 *     profundidad — el modal puede haber editado y roto el cuadre).
 *   - Payload inválido: missing lines → 400.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

const {
  mockRequireAuth,
  mockRequireOrgAccess,
  mockRequirePermission,
  mockGetMember,
  mockCreateEntry,
  mockGetVoucherByCode,
  mockFindPeriodByDate,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetMember: vi.fn(),
  mockCreateEntry: vi.fn(),
  mockGetVoucherByCode: vi.fn(),
  mockFindPeriodByDate: vi.fn(),
}));

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: mockRequireAuth,
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
        { status: 400 },
      );
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

vi.mock("@/features/organizations/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/organizations/server")>();
  return {
    ...actual,
    requireOrgAccess: mockRequireOrgAccess,
    OrganizationsService: vi.fn().mockImplementation(function () {
      return { getMemberWithUserByClerkUserId: mockGetMember };
    }),
  };
});

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/ai-agent/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai-agent/server")>();
  return {
    ...actual,
    AgentService: vi.fn().mockImplementation(function () {
      return { query: vi.fn() };
    }),
    AgentRateLimitService: vi.fn().mockImplementation(function () {
      return { check: vi.fn().mockResolvedValue({ allowed: true }) };
    }),
  };
});

vi.mock("@/features/accounting/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/accounting/server")>();
  return {
    ...actual,
    JournalService: vi.fn().mockImplementation(function () {
      return { createEntry: mockCreateEntry };
    }),
  };
});

vi.mock("@/features/voucher-types/server", () => ({
  VoucherTypesService: vi.fn().mockImplementation(function () {
    return { getByCode: mockGetVoucherByCode };
  }),
}));

vi.mock("@/features/fiscal-periods/server", () => ({
  FiscalPeriodsService: vi.fn().mockImplementation(function () {
    return { findByDate: mockFindPeriodByDate };
  }),
}));

vi.mock("@/features/expenses/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/expenses/server")>();
  return {
    ...actual,
    ExpensesService: vi.fn().mockImplementation(function () {
      return { create: vi.fn() };
    }),
  };
});

vi.mock("@/features/mortality/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/mortality/server")>();
  return {
    ...actual,
    MortalityService: vi.fn().mockImplementation(function () {
      return { log: vi.fn() };
    }),
  };
});

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { POST } from "../route";
import { ForbiddenError, ValidationError, FISCAL_PERIOD_CLOSED, JOURNAL_NOT_BALANCED } from "@/features/shared/errors";

// ── Constants & fixtures ───────────────────────────────────────────────────

const ORG_SLUG = "acme";
const ORG_ID = "org-acme";
const CLERK_USER_ID = "user_clerk_id";
const USER_ID = "user-1";
const ACC_EXPENSE = "clxx00000000000000000001";
const ACC_BANK = "clxx00000000000000000002";

function validSuggestionData() {
  return {
    template: "expense_bank_payment",
    voucherTypeCode: "CE",
    date: "2026-04-26",
    description: "Compra de alimento balanceado",
    amount: 5000,
    lines: [
      { accountId: ACC_EXPENSE, debit: 5000, credit: 0 },
      { accountId: ACC_BANK, debit: 0, credit: 5000 },
    ],
    originalText: "compra de alimento por 5000 al banco",
    resolvedAccounts: {
      [ACC_EXPENSE]: { code: "5.1.2", name: "Alimento", requiresContact: false },
      [ACC_BANK]: { code: "1.1.3.1", name: "Banco BCP", requiresContact: false },
    },
  };
}

function makeRequest(body: unknown, action = "confirm"): Request {
  return new Request(`http://test/api/organizations/${ORG_SLUG}/agent?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: CLERK_USER_ID });
  mockRequireOrgAccess.mockResolvedValue(ORG_ID);
  mockGetMember.mockResolvedValue({
    user: { id: USER_ID },
    role: "contador",
  });
  mockRequirePermission.mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "contador",
  });
  mockGetVoucherByCode.mockResolvedValue({
    id: "vt-CE",
    code: "CE",
    prefix: "E",
    name: "Comprobante de Egreso",
  });
  mockFindPeriodByDate.mockResolvedValue({
    id: "period-2026-04",
    status: "OPEN",
    year: 2026,
    month: 4,
  });
  mockCreateEntry.mockResolvedValue({
    id: "entry-1",
    number: 1,
    date: new Date("2026-04-26"),
    voucherType: { prefix: "E" },
  });
});

// ── Happy path ─────────────────────────────────────────────────────────────

describe("POST /api/organizations/[orgSlug]/agent?action=confirm — createJournalEntry", () => {
  it("(a) happy path: 201 + journalService.createEntry con sourceType='ai' y aiOriginalText", async () => {
    const req = makeRequest({
      suggestion: { action: "createJournalEntry", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("Borrador creado");
    expect(body.data.displayNumber).toMatch(/^E\d{4}-\d{6}$/);

    expect(mockCreateEntry).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateEntry.mock.calls[0];
    expect(callArgs[0]).toBe(ORG_ID);
    expect(callArgs[1]).toMatchObject({
      sourceType: "ai",
      aiOriginalText: "compra de alimento por 5000 al banco",
      voucherTypeId: "vt-CE",
      periodId: "period-2026-04",
      createdById: USER_ID,
      description: "Compra de alimento balanceado",
    });
    expect(callArgs[1].lines).toHaveLength(2);
    expect(callArgs[1].lines[0]).toMatchObject({
      accountId: ACC_EXPENSE,
      debit: 5000,
      credit: 0,
      order: 0,
    });
    expect(callArgs[1].lines[1]).toMatchObject({
      accountId: ACC_BANK,
      debit: 0,
      credit: 5000,
      order: 1,
    });
  });

  it("(a-bis) defensa en profundidad: el shape de display (resolvedAccounts) NO se reenvía al service", async () => {
    const req = makeRequest({
      suggestion: { action: "createJournalEntry", data: validSuggestionData() },
    });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const sentToService = mockCreateEntry.mock.calls[0][1];
    expect(sentToService).not.toHaveProperty("resolvedAccounts");
    expect(sentToService).not.toHaveProperty("resolvedContact");
    expect(sentToService).not.toHaveProperty("voucherTypeCode");
  });

  // ── RBAC denegado ────────────────────────────────────────────────────────

  it("(b) RBAC: rol sin journal:write → 403", async () => {
    mockRequirePermission.mockRejectedValueOnce(
      new ForbiddenError("Sin permiso para journal:write"),
    );
    const req = makeRequest({
      suggestion: { action: "createJournalEntry", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  // ── Período inexistente ─────────────────────────────────────────────────

  it("(c) período inexistente para la fecha → 422 con mensaje claro", async () => {
    mockFindPeriodByDate.mockResolvedValueOnce(null);
    const req = makeRequest({
      suggestion: { action: "createJournalEntry", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("período fiscal");
    expect(body.error).toContain("2026-04-26");
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  // ── Período cerrado ─────────────────────────────────────────────────────

  it("(d) período cerrado al momento del confirm → 422 con FISCAL_PERIOD_CLOSED", async () => {
    mockFindPeriodByDate.mockResolvedValueOnce({
      id: "period-closed",
      status: "CLOSED",
      year: 2026,
      month: 3,
    });
    const data = { ...validSuggestionData(), date: "2026-03-15" };
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(FISCAL_PERIOD_CLOSED);
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  it("(d-bis) período cerrado detectado por el service (defensa en profundidad)", async () => {
    // Simula que findByDate retorna un período OPEN (snapshot) pero el service ve
    // otro estado al persistir (race condition / contención). El service tira
    // FISCAL_PERIOD_CLOSED y debe propagarse como 422.
    mockCreateEntry.mockRejectedValueOnce(
      new ValidationError("Período cerrado", FISCAL_PERIOD_CLOSED),
    );
    const req = makeRequest({
      suggestion: { action: "createJournalEntry", data: validSuggestionData() },
    });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(FISCAL_PERIOD_CLOSED);
  });

  // ── Cuadre roto (defensa en profundidad) ────────────────────────────────

  it("(e) cuadre roto en el payload → 422 con JOURNAL_NOT_BALANCED (service rechaza)", async () => {
    // Modal pudo haber editado y roto el cuadre — el route handler no valida cuadre,
    // pero el service sí. Defensa en profundidad: el error tipado del service
    // viaja al cliente como 422 con el code correcto.
    mockCreateEntry.mockRejectedValueOnce(
      new ValidationError("Débitos y créditos no balancean", JOURNAL_NOT_BALANCED),
    );
    const data = validSuggestionData();
    data.lines[0].debit = 4500; // descuadrado intencional (4500 vs 5000)
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(JOURNAL_NOT_BALANCED);
  });

  // ── Validación de payload ───────────────────────────────────────────────

  it("(f) payload sin lines → 400 (Zod rechaza)", async () => {
    const data = { ...validSuggestionData(), lines: [] };
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  it("(g) payload sin originalText → 400", async () => {
    const data = { ...validSuggestionData() };
    delete (data as Record<string, unknown>).originalText;
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  // ── Variantes de plantilla ──────────────────────────────────────────────

  it("(h-tz) datetime con offset Bolivia → resuelve período por fecha calendario, no por UTC", async () => {
    // El LLM (o cliente futuro) puede mandar la fecha como "2026-04-30T23:00:00-04:00"
    // queriendo decir "30 de abril 11pm hora La Paz". En UTC esa fecha es las 3am
    // del 1 de mayo. Si findByDate usara UTC ciegamente, el asiento caería en
    // mayo. Verificamos que el route handler extrae solo la parte de fecha
    // calendario y resuelve período de abril.
    const data = {
      ...validSuggestionData(),
      date: "2026-04-30T23:00:00-04:00",
    };
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const findByDateCall = mockFindPeriodByDate.mock.calls[0];
    const dateArg = findByDateCall[1] as Date;
    expect(dateArg.getUTCFullYear()).toBe(2026);
    expect(dateArg.getUTCMonth() + 1).toBe(4); // abril, no mayo
    expect(dateArg.getUTCDate()).toBe(30);
  });

  it("(h-tz-2) date-only YYYY-MM-DD pasa intacto sin reinterpretación", async () => {
    const data = { ...validSuggestionData(), date: "2026-04-26" };
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const dateArg = mockFindPeriodByDate.mock.calls[0][1] as Date;
    expect(dateArg.getUTCFullYear()).toBe(2026);
    expect(dateArg.getUTCMonth() + 1).toBe(4);
    expect(dateArg.getUTCDate()).toBe(26);
  });

  it("(h) bank_deposit usa voucherTypeCode='CI' (no 'CE')", async () => {
    mockGetVoucherByCode.mockResolvedValueOnce({
      id: "vt-CI",
      code: "CI",
      prefix: "I",
      name: "Comprobante de Ingreso",
    });
    const data = {
      template: "bank_deposit",
      voucherTypeCode: "CI",
      date: "2026-04-26",
      description: "Depósito al banco BCP",
      amount: 10000,
      lines: [
        { accountId: ACC_BANK, debit: 10000, credit: 0 },
        { accountId: ACC_EXPENSE, debit: 0, credit: 10000 },
      ],
      originalText: "deposité 10000 al banco",
      resolvedAccounts: {},
    };
    const req = makeRequest({ suggestion: { action: "createJournalEntry", data } });
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    expect(mockGetVoucherByCode).toHaveBeenCalledWith(ORG_ID, "CI");
  });
});
