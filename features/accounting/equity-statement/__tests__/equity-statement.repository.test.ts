/**
 * T04 — RED→GREEN: Integration tests for EquityStatementRepository against real DB.
 *
 * Covers: REQ-3 (saldo inicial/final), REQ-8 (POSTED filter, multi-tenant), REQ-9 (org scoping)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { EquityStatementRepository } from "../equity-statement.repository";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const repo = new EquityStatementRepository();

let orgAId: string;
let orgBId: string;
let userId: string;
let voucherTypeId: string;
let periodAId: string;
let periodBId: string;

let capitalAccountId: string;
let activoAccountId: string;
let reservaAccountId: string;
let resultadosAccountId: string;
let orgBCapitalAccountId: string;
let vtCP_A: string;
let vtCL_A: string;
let vtCV_A: string;
let vtCP_B: string;

const DATE_INITIAL = new Date("2024-01-01");
const DATE_FINAL   = new Date("2024-12-31");
const DATE_BEFORE  = new Date("2023-12-31");

beforeAll(async () => {
  const now = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-eepn-repo-${now}`,
      email: `eepn-repo-${now}@test.com`,
      name: "EEPN Repo Test",
    },
  });
  userId = user.id;

  const orgA = await prisma.organization.create({
    data: { clerkOrgId: `clerk-eepn-orgA-${now}`, slug: `eepn-orgA-${now}`, name: "EEPN Org A" },
  });
  orgAId = orgA.id;

  const orgB = await prisma.organization.create({
    data: { clerkOrgId: `clerk-eepn-orgB-${now}`, slug: `eepn-orgB-${now}`, name: "EEPN Org B" },
  });
  orgBId = orgB.id;

  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgAId, userId, role: "owner" },
      { organizationId: orgBId, userId, role: "owner" },
    ],
  });

  // FiscalPeriods
  const periodA = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgAId,
      name: "Ejercicio 2024",
      year: 2024,
      startDate: DATE_INITIAL,
      endDate: DATE_FINAL,
      status: "CLOSED",
      createdById: userId,
    },
  });
  periodAId = periodA.id;

  const periodB = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgBId,
      name: "Ejercicio 2024",
      year: 2024,
      startDate: DATE_INITIAL,
      endDate: DATE_FINAL,
      createdById: userId,
    },
  });
  periodBId = periodB.id;

  // VoucherType for org A
  const vt = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgAId,
      code: `CI-EEPN-${now}`,
      prefix: "CI",
      name: "Comprobante de Ingreso",
      isAdjustment: false,
    },
  });
  voucherTypeId = vt.id;

  // VoucherType for org B
  const vtB = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgBId,
      code: `CI-EEPN-B-${now}`,
      prefix: "CI",
      name: "Comprobante Ingreso",
      isAdjustment: false,
    },
  });

  // PATRIMONIO account for Org A
  const capitalAcc = await prisma.account.create({
    data: {
      organizationId: orgAId,
      code: "3.1.1",
      name: "Capital Social",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  capitalAccountId = capitalAcc.id;

  // ACTIVO account for Org A (should be excluded from EEPN)
  const activoAcc = await prisma.account.create({
    data: {
      organizationId: orgAId,
      code: "1.1.1",
      name: "Caja",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  activoAccountId = activoAcc.id;

  // PATRIMONIO account for Org B
  const orgBCapital = await prisma.account.create({
    data: {
      organizationId: orgBId,
      code: "3.1.1",
      name: "Capital Social OrgB",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  orgBCapitalAccountId = orgBCapital.id;

  // Reserva Legal + Resultados Acumulados accounts for Org A (for typed movement tests)
  const reservaAcc = await prisma.account.create({
    data: {
      organizationId: orgAId,
      code: "3.3.1",
      name: "Reserva Legal",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  reservaAccountId = reservaAcc.id;

  const resultadosAcc = await prisma.account.create({
    data: {
      organizationId: orgAId,
      code: "3.4.1",
      name: "Resultados Acumulados",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  resultadosAccountId = resultadosAcc.id;

  // Patrimony voucher types (code=CP/CL/CV) for Org A
  const vtCP = await prisma.voucherTypeCfg.create({
    data: { organizationId: orgAId, code: "CP", prefix: "P", name: "Comprobante de Aporte de Capital", isAdjustment: false },
  });
  vtCP_A = vtCP.id;
  const vtCL = await prisma.voucherTypeCfg.create({
    data: { organizationId: orgAId, code: "CL", prefix: "L", name: "Comprobante de Constitución de Reserva", isAdjustment: false },
  });
  vtCL_A = vtCL.id;
  const vtCV = await prisma.voucherTypeCfg.create({
    data: { organizationId: orgAId, code: "CV", prefix: "V", name: "Comprobante de Distribución a Socios", isAdjustment: false },
  });
  vtCV_A = vtCV.id;

  // Patrimony voucher type CP in Org B — used to verify multi-tenant scoping
  const vtCPB = await prisma.voucherTypeCfg.create({
    data: { organizationId: orgBId, code: "CP", prefix: "P", name: "CP OrgB", isAdjustment: false },
  });
  vtCP_B = vtCPB.id;

  // POSTED entry in org A (2024-06-15) — 5000 credit to Capital Social
  const postedEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 1,
      date: new Date("2024-06-15"),
      description: "Aporte capital",
      status: "POSTED",
      periodId: periodAId,
      voucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: postedEntry.id, accountId: activoAccountId,  debit: D("5000"), credit: D("0") },
      { journalEntryId: postedEntry.id, accountId: capitalAccountId, debit: D("0"),    credit: D("5000") },
    ],
  });

  // DRAFT entry in org A — should NOT be included
  const draftEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 2,
      date: new Date("2024-07-01"),
      description: "Borrador",
      status: "DRAFT",
      periodId: periodAId,
      voucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: draftEntry.id, accountId: activoAccountId,  debit: D("1000"), credit: D("0") },
      { journalEntryId: draftEntry.id, accountId: capitalAccountId, debit: D("0"),    credit: D("1000") },
    ],
  });

  // POSTED entry BEFORE DATE_INITIAL (2023-12-31 — needs a "2023" period-ish)
  // We'll create a separate period for the before entry
  const period2023 = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgAId,
      name: "Ejercicio 2023",
      year: 2023,
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      status: "CLOSED",
      createdById: userId,
    },
  });

  const beforeEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 3,
      date: DATE_BEFORE,
      description: "Saldo anterior",
      status: "POSTED",
      periodId: period2023.id,
      voucherTypeId,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: beforeEntry.id, accountId: activoAccountId,  debit: D("2000"), credit: D("0") },
      { journalEntryId: beforeEntry.id, accountId: capitalAccountId, debit: D("0"),    credit: D("2000") },
    ],
  });

  // POSTED entry in org B — must not bleed into org A
  const orgBEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgBId,
      number: 1,
      date: new Date("2024-06-15"),
      description: "OrgB capital",
      status: "POSTED",
      periodId: periodBId,
      voucherTypeId: vtB.id,
      createdById: userId,
    },
  });
  await prisma.journalLine.create({
    data: {
      journalEntryId: orgBEntry.id,
      accountId: orgBCapitalAccountId,
      debit: D("0"),
      credit: D("9999"),
    },
  });

  // ── Typed patrimony entries (voucherType CP/CL/CV) for getTypedPatrimonyMovements ──

  // CP POSTED: aporte 200000 a capital (2024-06-01) — DEBIT activo / CREDIT capital
  const cpEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 10,
      date: new Date("2024-06-01"),
      description: "Aporte de Capital",
      status: "POSTED",
      periodId: periodAId,
      voucherTypeId: vtCP_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cpEntry.id, accountId: activoAccountId,  debit: D("200000"), credit: D("0") },
      { journalEntryId: cpEntry.id, accountId: capitalAccountId, debit: D("0"),      credit: D("200000") },
    ],
  });

  // CL POSTED: constitución de reserva legal 30000 (2024-06-02)
  const clEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 11,
      date: new Date("2024-06-02"),
      description: "Constitución Reserva Legal",
      status: "POSTED",
      periodId: periodAId,
      voucherTypeId: vtCL_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: clEntry.id, accountId: resultadosAccountId, debit: D("30000"), credit: D("0") },
      { journalEntryId: clEntry.id, accountId: reservaAccountId,    debit: D("0"),     credit: D("30000") },
    ],
  });

  // CV POSTED: distribución de utilidades 50000 (2024-06-03) — DEBIT resultados / CREDIT activo
  const cvEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 12,
      date: new Date("2024-06-03"),
      description: "Distribución a Socios",
      status: "POSTED",
      periodId: periodAId,
      voucherTypeId: vtCV_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cvEntry.id, accountId: resultadosAccountId, debit: D("50000"), credit: D("0") },
      { journalEntryId: cvEntry.id, accountId: activoAccountId,     debit: D("0"),     credit: D("50000") },
    ],
  });

  // CP DRAFT: must be excluded
  const cpDraft = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 13,
      date: new Date("2024-06-04"),
      description: "Aporte Capital (borrador)",
      status: "DRAFT",
      periodId: periodAId,
      voucherTypeId: vtCP_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: cpDraft.id, accountId: activoAccountId,  debit: D("99999"), credit: D("0") },
      { journalEntryId: cpDraft.id, accountId: capitalAccountId, debit: D("0"),     credit: D("99999") },
    ],
  });

  // CP in Org B: must be excluded from Org A results
  const cpOrgB = await prisma.journalEntry.create({
    data: {
      organizationId: orgBId,
      number: 2,
      date: new Date("2024-06-15"),
      description: "OrgB aporte capital",
      status: "POSTED",
      periodId: periodBId,
      voucherTypeId: vtCP_B,
      createdById: userId,
    },
  });
  await prisma.journalLine.create({
    data: {
      journalEntryId: cpOrgB.id,
      accountId: orgBCapitalAccountId,
      debit: D("0"),
      credit: D("77777"),
    },
  });

});

afterAll(async () => {
  if (orgAId) {
    await prisma.organization.delete({ where: { id: orgAId } }).catch(() => {});
  }
  if (orgBId) {
    await prisma.organization.delete({ where: { id: orgBId } }).catch(() => {});
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
});

describe("EquityStatementRepository — server-only boundary", () => {
  it("repository file starts with import 'server-only'", () => {
    const repoPath = path.join(__dirname, "../equity-statement.repository.ts");
    const content = fs.readFileSync(repoPath, "utf8");
    expect(content.startsWith(`import "server-only"`)).toBe(true);
  });
});

describe("EquityStatementRepository — getPatrimonioBalancesAt", () => {
  it("POSTED filter: DRAFT entries are excluded from balance", async () => {
    // cutoff = DATE_FINAL — includes POSTED 5000 (CI 2024-06-15) + POSTED 2000 (2023-12-31)
    //                     + POSTED 200000 (CP 2024-06-01); excludes DRAFT 1000 (CI 2024-07-01)
    //                     and DRAFT 99999 (CP 2024-06-04).
    const balances = await repo.getPatrimonioBalancesAt(orgAId, DATE_FINAL);
    const capitalBalance = balances.get(capitalAccountId);
    expect(capitalBalance).toBeDefined();
    expect(capitalBalance?.equals(D("207000"))).toBe(true);
  });

  it("PATRIMONIO type filter: ACTIVO accounts are excluded", async () => {
    const balances = await repo.getPatrimonioBalancesAt(orgAId, DATE_FINAL);
    expect(balances.has(activoAccountId)).toBe(false);
  });

  it("multi-tenant scoping: org A results do not include org B accounts", async () => {
    const balances = await repo.getPatrimonioBalancesAt(orgAId, DATE_FINAL);
    expect(balances.has(orgBCapitalAccountId)).toBe(false);
  });

  it("initial balance cutoff: entries ON cutoff date (2023-12-31) are included", async () => {
    const balances = await repo.getPatrimonioBalancesAt(orgAId, DATE_BEFORE);
    const capitalBalance = balances.get(capitalAccountId);
    expect(capitalBalance).toBeDefined();
    expect(capitalBalance?.equals(D("2000"))).toBe(true);
  });

  it("initial balance cutoff: entries AFTER cutoff are excluded", async () => {
    const balances = await repo.getPatrimonioBalancesAt(orgAId, new Date("2023-12-30"));
    expect(balances.size).toBe(0);
  });

  it("signed-net ACREEDORA: balance = credit - debit (positive for credit > debit)", async () => {
    const balances = await repo.getPatrimonioBalancesAt(orgAId, DATE_FINAL);
    const bal = balances.get(capitalAccountId);
    expect(bal?.gt(D("0"))).toBe(true);
  });
});

describe("EquityStatementRepository — findPatrimonioAccounts", () => {
  it("returns only PATRIMONIO accounts for the org", async () => {
    const accounts = await repo.findPatrimonioAccounts(orgAId);
    const ids = accounts.map((a) => a.id);
    expect(ids).toContain(capitalAccountId);
    expect(ids).not.toContain(activoAccountId);
    expect(ids).not.toContain(orgBCapitalAccountId);
  });

  it("returned accounts have id, code, name, nature fields", async () => {
    const accounts = await repo.findPatrimonioAccounts(orgAId);
    for (const acc of accounts) {
      expect(acc).toHaveProperty("id");
      expect(acc).toHaveProperty("code");
      expect(acc).toHaveProperty("name");
      expect(acc).toHaveProperty("nature");
    }
  });
});

describe("EquityStatementRepository — getTypedPatrimonyMovements", () => {
  it("REQ-1 — CP POSTED in range produces Map('CP' → {capitalAccountId: 200000})", async () => {
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    const cp = movements.get("CP");
    expect(cp, "CP bucket must exist").toBeDefined();
    const delta = cp!.get(capitalAccountId);
    expect(delta, "capital account delta must exist for CP").toBeDefined();
    expect(delta!.equals(D("200000"))).toBe(true);
  });

  it("REQ-1 — CL POSTED in range produces Map('CL' → {reservaAccountId: 30000})", async () => {
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    const cl = movements.get("CL");
    expect(cl).toBeDefined();
    expect(cl!.get(reservaAccountId)!.equals(D("30000"))).toBe(true);
  });

  it("REQ-4 — CV POSTED (debit to 3.4) produces Map('CV' → {resultadosAccountId: -50000})", async () => {
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    const cv = movements.get("CV");
    expect(cv).toBeDefined();
    // ACREEDORA sign convention: debit → negative delta
    expect(cv!.get(resultadosAccountId)!.equals(D("-50000"))).toBe(true);
  });

  it("POSTED filter — DRAFT entries are excluded from typed movements", async () => {
    // CP DRAFT for 99999 was seeded; the CP bucket must only contain 200000
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    const delta = movements.get("CP")!.get(capitalAccountId)!;
    expect(delta.equals(D("200000"))).toBe(true);
    expect(delta.equals(D("299999"))).toBe(false);
  });

  it("multi-tenant scoping — org B CP entry does not leak into org A results", async () => {
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    const cp = movements.get("CP")!;
    expect(cp.has(orgBCapitalAccountId)).toBe(false);
  });

  it("date range — entries before dateFrom are excluded", async () => {
    // CP out-of-range (2023-06-01) contributes 11111 to capitalAccountId; if range
    // filter works, bucket contains 200000 (not 211111).
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    const delta = movements.get("CP")!.get(capitalAccountId)!;
    expect(delta.equals(D("200000"))).toBe(true);
  });

  it("date range — narrowing to a sub-range excludes entries outside it", async () => {
    // Only CL (2024-06-02) and CV (2024-06-03) fall inside [2024-06-02, 2024-06-03]
    const movements = await repo.getTypedPatrimonyMovements(
      orgAId,
      new Date("2024-06-02"),
      new Date("2024-06-03"),
    );
    expect(movements.has("CL")).toBe(true);
    expect(movements.has("CV")).toBe(true);
    expect(movements.has("CP")).toBe(false);
  });

  it("only patrimony account lines are aggregated (type=PATRIMONIO filter)", async () => {
    // CP entry has an offsetting debit to activoAccountId (ACTIVO) — that line MUST NOT
    // appear in the CP bucket, which should only track PATRIMONIO account movements.
    const movements = await repo.getTypedPatrimonyMovements(orgAId, DATE_INITIAL, DATE_FINAL);
    for (const [, accMap] of movements) {
      expect(accMap.has(activoAccountId)).toBe(false);
    }
  });
});

describe("EquityStatementRepository — isClosedPeriodMatch", () => {
  it("returns true when FiscalPeriod CLOSED exists with exact date match", async () => {
    const result = await repo.isClosedPeriodMatch(orgAId, DATE_INITIAL, DATE_FINAL);
    expect(result).toBe(true);
  });

  it("returns false when dates don't match any CLOSED period", async () => {
    const result = await repo.isClosedPeriodMatch(orgAId, DATE_INITIAL, new Date("2024-06-30"));
    expect(result).toBe(false);
  });

  it("returns false for org B (no CLOSED period with matching dates)", async () => {
    const result = await repo.isClosedPeriodMatch(orgBId, DATE_INITIAL, DATE_FINAL);
    expect(result).toBe(false);
  });
});
