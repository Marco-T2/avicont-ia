/**
 * T03 / T03b / T03c — RED: Integration tests for InitialBalanceRepository.
 *
 * Seeds two orgs each with a POSTED CA voucher. Verifies:
 *   T03  — `getInitialBalanceFromCA(orgA)` returns only orgA lines with correct
 *          signed-net (debit−credit for DEUDORA, credit−debit for ACREEDORA) and
 *          excludes orgB rows.
 *   T03b — `countCAVouchers` returns 0 when no CA, 2 when two CAs, and is
 *          multi-tenant isolated.
 *   T03c — `getOrgMetadata` returns { razonSocial, nit, representanteLegal,
 *          direccion } for a seeded org and is multi-tenant isolated.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { InitialBalanceRepository } from "../initial-balance.repository";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const repo = new InitialBalanceRepository();

// ── Shared fixtures: two orgs (A, B) each with a POSTED CA ────────────────────

let userId: string;
let orgAId: string;
let orgBId: string;
let orgEmptyId: string; // third org with ZERO CAs (for T03b "0 CAs" case)

let vtCA_A: string;
let vtCA_B: string;
let vtCA_Empty: string; // not used for CA entries; present so the org has a voucher-type

let periodAId: string;
let periodBId: string;
let periodEmptyId: string;

// OrgA accounts
let orgA_CapitalAccId: string;   // PATRIMONIO ACREEDORA
let orgA_CajaAccId: string;      // ACTIVO DEUDORA
// OrgB accounts
let orgB_CapitalAccId: string;   // PATRIMONIO ACREEDORA
let orgB_CajaAccId: string;      // ACTIVO DEUDORA

const CA_DATE_A_1 = new Date("2026-01-10");
const CA_DATE_A_2 = new Date("2026-01-20");
const CA_DATE_B   = new Date("2026-02-15");

beforeAll(async () => {
  const now = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-ib-repo-${now}`,
      email: `ib-repo-${now}@test.com`,
      name: "IB Repo Test",
    },
  });
  userId = user.id;

  const orgA = await prisma.organization.create({
    data: { clerkOrgId: `clerk-ib-orgA-${now}`, slug: `ib-orgA-${now}`, name: "IB Org A" },
  });
  orgAId = orgA.id;

  const orgB = await prisma.organization.create({
    data: { clerkOrgId: `clerk-ib-orgB-${now}`, slug: `ib-orgB-${now}`, name: "IB Org B" },
  });
  orgBId = orgB.id;

  const orgEmpty = await prisma.organization.create({
    data: { clerkOrgId: `clerk-ib-orgE-${now}`, slug: `ib-orgE-${now}`, name: "IB Org Empty" },
  });
  orgEmptyId = orgEmpty.id;

  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgAId,      userId, role: "owner" },
      { organizationId: orgBId,      userId, role: "owner" },
      { organizationId: orgEmptyId,  userId, role: "owner" },
    ],
  });

  // OrgProfile for T03c assertions
  await prisma.orgProfile.create({
    data: {
      organizationId: orgAId,
      razonSocial: "IB Org A S.R.L.",
      nit: "1234567890",
      direccion: "Av. Siempreviva 742, La Paz",
      ciudad: "La Paz",
      telefono: "22000000",
      representanteLegal: "Ing. Test Representante",
    },
  });
  await prisma.orgProfile.create({
    data: {
      organizationId: orgBId,
      razonSocial: "IB Org B S.R.L.",
      nit: "9876543210",
      direccion: "Calle Potosí 100, Cochabamba",
      ciudad: "Cochabamba",
      telefono: "44111111",
    },
  });

  // Fiscal periods
  const periodA = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgAId,
      name: "Ejercicio 2026",
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      createdById: userId,
    },
  });
  periodAId = periodA.id;

  const periodB = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgBId,
      name: "Ejercicio 2026",
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      createdById: userId,
    },
  });
  periodBId = periodB.id;

  const periodEmpty = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgEmptyId,
      name: "Ejercicio 2026",
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      createdById: userId,
    },
  });
  periodEmptyId = periodEmpty.id;

  // VoucherTypeCfg code='CA' in each org
  const vtA = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgAId,
      code: "CA",
      prefix: "A",
      name: "Comprobante de Apertura",
      isAdjustment: false,
    },
  });
  vtCA_A = vtA.id;

  const vtB = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgBId,
      code: "CA",
      prefix: "A",
      name: "Comprobante de Apertura",
      isAdjustment: false,
    },
  });
  vtCA_B = vtB.id;

  const vtEmpty = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgEmptyId,
      code: "CA",
      prefix: "A",
      name: "Comprobante de Apertura",
      isAdjustment: false,
    },
  });
  vtCA_Empty = vtEmpty.id;

  // OrgA accounts
  const orgACapital = await prisma.account.create({
    data: {
      organizationId: orgAId,
      code: "3.1.1",
      name: "Capital Social",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      subtype: "PATRIMONIO_CAPITAL",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  orgA_CapitalAccId = orgACapital.id;

  const orgACaja = await prisma.account.create({
    data: {
      organizationId: orgAId,
      code: "1.1.1",
      name: "Caja",
      type: "ACTIVO",
      nature: "DEUDORA",
      subtype: "ACTIVO_CORRIENTE",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  orgA_CajaAccId = orgACaja.id;

  // OrgB accounts
  const orgBCapital = await prisma.account.create({
    data: {
      organizationId: orgBId,
      code: "3.1.1",
      name: "Capital Social OrgB",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      subtype: "PATRIMONIO_CAPITAL",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  orgB_CapitalAccId = orgBCapital.id;

  const orgBCaja = await prisma.account.create({
    data: {
      organizationId: orgBId,
      code: "1.1.1",
      name: "Caja OrgB",
      type: "ACTIVO",
      nature: "DEUDORA",
      subtype: "ACTIVO_CORRIENTE",
      level: 3,
      isDetail: true,
      isActive: true,
      isContraAccount: false,
    },
  });
  orgB_CajaAccId = orgBCaja.id;

  // ── OrgA: TWO POSTED CAs (for T03b "2 CAs" and T03 aggregation) ────────────
  // CA #1: Debit Caja 120000 / Credit Capital 120000
  const caA1 = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 1,
      date: CA_DATE_A_1,
      description: "Apertura capital A-1",
      status: "POSTED",
      periodId: periodAId,
      voucherTypeId: vtCA_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: caA1.id, accountId: orgA_CajaAccId,    debit: D("120000"), credit: D("0") },
      { journalEntryId: caA1.id, accountId: orgA_CapitalAccId, debit: D("0"),      credit: D("120000") },
    ],
  });

  // CA #2: Debit Caja 80000 / Credit Capital 80000 (sum with #1 → 200000)
  const caA2 = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 2,
      date: CA_DATE_A_2,
      description: "Apertura capital A-2",
      status: "POSTED",
      periodId: periodAId,
      voucherTypeId: vtCA_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: caA2.id, accountId: orgA_CajaAccId,    debit: D("80000"), credit: D("0") },
      { journalEntryId: caA2.id, accountId: orgA_CapitalAccId, debit: D("0"),     credit: D("80000") },
    ],
  });

  // OrgA DRAFT CA — must be excluded
  const caADraft = await prisma.journalEntry.create({
    data: {
      organizationId: orgAId,
      number: 3,
      date: new Date("2026-01-05"),
      description: "Apertura borrador",
      status: "DRAFT",
      periodId: periodAId,
      voucherTypeId: vtCA_A,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: caADraft.id, accountId: orgA_CajaAccId,    debit: D("99999"), credit: D("0") },
      { journalEntryId: caADraft.id, accountId: orgA_CapitalAccId, debit: D("0"),     credit: D("99999") },
    ],
  });

  // ── OrgB: ONE POSTED CA (for T03 isolation and T03b different count) ───────
  const caB1 = await prisma.journalEntry.create({
    data: {
      organizationId: orgBId,
      number: 1,
      date: CA_DATE_B,
      description: "Apertura capital B",
      status: "POSTED",
      periodId: periodBId,
      voucherTypeId: vtCA_B,
      createdById: userId,
    },
  });
  await prisma.journalLine.createMany({
    data: [
      { journalEntryId: caB1.id, accountId: orgB_CajaAccId,    debit: D("77777"), credit: D("0") },
      { journalEntryId: caB1.id, accountId: orgB_CapitalAccId, debit: D("0"),     credit: D("77777") },
    ],
  });

  // orgEmpty has NO CA entries (for T03b "0 CAs" case)
  // (Intentionally empty — vtCA_Empty exists but no JournalEntry references it)
  void vtCA_Empty; // silence unused warning
  void periodEmptyId;
});

afterAll(async () => {
  for (const id of [orgAId, orgBId, orgEmptyId]) {
    if (id) await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

// ── T03 — getInitialBalanceFromCA ────────────────────────────────────────────
describe("InitialBalanceRepository — getInitialBalanceFromCA", () => {
  it("T03 — returns signed-net rows from POSTED CA for orgA (ACREEDORA credit−debit, DEUDORA debit−credit)", async () => {
    const rows = await repo.getInitialBalanceFromCA(orgAId);

    const capitalRow = rows.find((r) => r.accountId === orgA_CapitalAccId);
    const cajaRow    = rows.find((r) => r.accountId === orgA_CajaAccId);

    expect(capitalRow, "capital row must be present").toBeDefined();
    expect(cajaRow,    "caja row must be present").toBeDefined();

    // ACREEDORA (capital): credit − debit = (120000 + 80000) − 0 = 200000
    expect(capitalRow!.amount.equals(D("200000"))).toBe(true);
    // DEUDORA (caja): debit − credit = (120000 + 80000) − 0 = 200000
    expect(cajaRow!.amount.equals(D("200000"))).toBe(true);

    // Shape — each row carries subtype and code/name
    expect(capitalRow!.subtype).toBe("PATRIMONIO_CAPITAL");
    expect(cajaRow!.subtype).toBe("ACTIVO_CORRIENTE");
    expect(capitalRow!.code).toBe("3.1.1");
    expect(cajaRow!.code).toBe("1.1.1");
  });

  it("T03 — excludes orgB rows (multi-tenant isolation)", async () => {
    const rows = await repo.getInitialBalanceFromCA(orgAId);
    const ids = rows.map((r) => r.accountId);
    expect(ids).not.toContain(orgB_CapitalAccId);
    expect(ids).not.toContain(orgB_CajaAccId);
  });

  it("T03 — DRAFT CA is excluded from the aggregation (POSTED-only)", async () => {
    const rows = await repo.getInitialBalanceFromCA(orgAId);
    const capitalRow = rows.find((r) => r.accountId === orgA_CapitalAccId);
    // If DRAFT was included, capital would be 299999, not 200000.
    expect(capitalRow!.amount.equals(D("299999"))).toBe(false);
    expect(capitalRow!.amount.equals(D("200000"))).toBe(true);
  });

  it("T03 — returns only orgB rows when queried for orgB", async () => {
    const rows = await repo.getInitialBalanceFromCA(orgBId);
    const ids = rows.map((r) => r.accountId);
    expect(ids).toContain(orgB_CapitalAccId);
    expect(ids).toContain(orgB_CajaAccId);
    expect(ids).not.toContain(orgA_CapitalAccId);
    expect(ids).not.toContain(orgA_CajaAccId);
    const capitalB = rows.find((r) => r.accountId === orgB_CapitalAccId);
    expect(capitalB!.amount.equals(D("77777"))).toBe(true);
  });
});

// ── T03b — countCAVouchers ───────────────────────────────────────────────────
describe("InitialBalanceRepository — countCAVouchers", () => {
  it("T03b — returns 0 for an org with NO POSTED CA vouchers", async () => {
    const count = await repo.countCAVouchers(orgEmptyId);
    expect(count).toBe(0);
  });

  it("T03b — returns 2 for an org with TWO POSTED CA vouchers", async () => {
    const count = await repo.countCAVouchers(orgAId);
    expect(count).toBe(2);
  });

  it("T03b — multi-tenant: orgB CAs are NOT counted for orgA", async () => {
    // orgB has 1 POSTED CA; orgA has 2. If the query leaked, orgA would report 3.
    const countA = await repo.countCAVouchers(orgAId);
    const countB = await repo.countCAVouchers(orgBId);
    expect(countA).toBe(2);
    expect(countB).toBe(1);
  });

  it("T03b — DRAFT CAs are excluded from the count", async () => {
    // orgA has 1 DRAFT CA + 2 POSTED CAs. Count must be 2, not 3.
    const count = await repo.countCAVouchers(orgAId);
    expect(count).not.toBe(3);
    expect(count).toBe(2);
  });
});

// ── T03c — getOrgMetadata ────────────────────────────────────────────────────
describe("InitialBalanceRepository — getOrgMetadata", () => {
  it("T03c — returns { razonSocial, nit, representanteLegal, direccion, ciudad } for orgA", async () => {
    const meta = await repo.getOrgMetadata(orgAId);
    expect(meta).not.toBeNull();
    expect(meta!.razonSocial).toBe("IB Org A S.R.L.");
    expect(meta!.nit).toBe("1234567890");
    expect(meta!.direccion).toBe("Av. Siempreviva 742, La Paz");
    expect(meta!.representanteLegal).toBe("Ing. Test Representante");
    expect(meta!.ciudad).toBe("La Paz");
  });

  it("T03c — multi-tenant: orgA query never returns orgB data", async () => {
    const metaA = await repo.getOrgMetadata(orgAId);
    const metaB = await repo.getOrgMetadata(orgBId);
    expect(metaA!.razonSocial).toBe("IB Org A S.R.L.");
    expect(metaB!.razonSocial).toBe("IB Org B S.R.L.");
    expect(metaA!.nit).not.toBe(metaB!.nit);
    expect(metaA!.direccion).not.toBe(metaB!.direccion);
  });

  it("T03c — returns null when orgId does not exist", async () => {
    const meta = await repo.getOrgMetadata("org_does_not_exist");
    expect(meta).toBeNull();
  });
});
