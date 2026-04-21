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
let orgBCapitalAccountId: string;

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
    // cutoff = DATE_FINAL — includes POSTED 5000 (2024-06-15) + POSTED 2000 (2023-12-31)
    // excludes DRAFT 1000
    const balances = await repo.getPatrimonioBalancesAt(orgAId, DATE_FINAL);
    const capitalBalance = balances.get(capitalAccountId);
    expect(capitalBalance).toBeDefined();
    expect(capitalBalance?.equals(D("7000"))).toBe(true);
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
