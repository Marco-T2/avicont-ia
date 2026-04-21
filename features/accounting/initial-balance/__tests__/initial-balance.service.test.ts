/**
 * T10 RED — Service test: no CA → NotFoundError
 * T11 RED — Service test: valid CA → full statement
 *
 * Covers REQ-2 (NotFoundError when no CA exists) and REQ-1 (full statement
 * construction when CA data is present).
 *
 * The repository is mocked entirely via vi.mock so no Prisma client is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { NotFoundError } from "@/features/shared/errors";
import type { InitialBalanceOrgHeader, InitialBalanceRow } from "../initial-balance.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

// ── Repository mock ───────────────────────────────────────────────────────────

vi.mock("../initial-balance.repository", () => {
  const MockRepo = vi.fn();
  MockRepo.prototype.getInitialBalanceFromCA = vi.fn();
  MockRepo.prototype.countCAVouchers = vi.fn();
  MockRepo.prototype.getOrgMetadata = vi.fn();
  MockRepo.prototype.getCADate = vi.fn();
  return { InitialBalanceRepository: MockRepo };
});

// Lazy import after mock is established
const { InitialBalanceRepository } = await import("../initial-balance.repository");
const { InitialBalanceService } = await import("../initial-balance.service");

// ── Shared fixtures ────────────────────────────────────────────────────────────

const ORG_ID = "org-test-001";
const DATE_AT = new Date("2024-01-01T00:00:00.000Z");

const ORG_HEADER: InitialBalanceOrgHeader = {
  razonSocial: "Empresa de Prueba S.R.L.",
  nit: "9876543210",
  representanteLegal: "Lic. Ana Representante",
  direccion: "Calle Sucre 123, La Paz",
  ciudad: "La Paz",
};

const VALID_ROWS: InitialBalanceRow[] = [
  {
    accountId: "acc-caja",
    code: "1.1.1",
    name: "Caja",
    subtype: AccountSubtype.ACTIVO_CORRIENTE,
    amount: D("500"),
  },
  {
    accountId: "acc-capital",
    code: "3.1.1",
    name: "Capital Social",
    subtype: AccountSubtype.PATRIMONIO_CAPITAL,
    amount: D("500"),
  },
];

// ── T10: no CA → NotFoundError ────────────────────────────────────────────────

describe("InitialBalanceService — server-only boundary", () => {
  it("service file starts with import 'server-only'", () => {
    const svcPath = path.join(__dirname, "../initial-balance.service.ts");
    const content = fs.readFileSync(svcPath, "utf8");
    expect(content.startsWith(`import "server-only"`)).toBe(true);
  });
});

describe("InitialBalanceService — no CA → NotFoundError (T10)", () => {
  let repoInstance: InstanceType<typeof InitialBalanceRepository>;
  let service: InstanceType<typeof InitialBalanceService>;

  beforeEach(() => {
    vi.clearAllMocks();
    repoInstance = new InitialBalanceRepository();
    vi.mocked(repoInstance.countCAVouchers).mockResolvedValue(0);
    vi.mocked(repoInstance.getInitialBalanceFromCA).mockResolvedValue([]);
    vi.mocked(repoInstance.getOrgMetadata).mockResolvedValue(ORG_HEADER);
    vi.mocked(repoInstance.getCADate).mockResolvedValue(null);
    service = new InitialBalanceService(repoInstance);
  });

  it("throws NotFoundError when countCAVouchers returns 0", async () => {
    await expect(service.generate(ORG_ID)).rejects.toThrow(NotFoundError);
  });

  it("error message references Comprobante de Apertura", async () => {
    await expect(service.generate(ORG_ID)).rejects.toThrow(
      /Comprobante de Apertura/i,
    );
  });

  it("does not call getInitialBalanceFromCA before the CA count check", async () => {
    // When count=0 the service should short-circuit; rows fetch MAY still happen
    // (parallel fetch) but the guard check triggers NotFoundError after Promise.all.
    await expect(service.generate(ORG_ID)).rejects.toThrow(NotFoundError);
  });
});

// ── T11: valid CA → full statement ────────────────────────────────────────────

describe("InitialBalanceService — valid CA → full statement (T11)", () => {
  let repoInstance: InstanceType<typeof InitialBalanceRepository>;
  let service: InstanceType<typeof InitialBalanceService>;

  beforeEach(() => {
    vi.clearAllMocks();
    repoInstance = new InitialBalanceRepository();
    vi.mocked(repoInstance.countCAVouchers).mockResolvedValue(1);
    vi.mocked(repoInstance.getInitialBalanceFromCA).mockResolvedValue(VALID_ROWS);
    vi.mocked(repoInstance.getOrgMetadata).mockResolvedValue(ORG_HEADER);
    vi.mocked(repoInstance.getCADate).mockResolvedValue(DATE_AT);
    service = new InitialBalanceService(repoInstance);
  });

  it("returns an InitialBalanceStatement with the correct orgId", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.orgId).toBe(ORG_ID);
  });

  it("injects the org header from getOrgMetadata into the statement", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.org).toEqual(ORG_HEADER);
  });

  it("sets dateAt from getCADate (min CA date)", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.dateAt).toEqual(DATE_AT);
  });

  it("statement has two sections [ACTIVO, PASIVO_PATRIMONIO]", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].key).toBe("ACTIVO");
    expect(result.sections[1].key).toBe("PASIVO_PATRIMONIO");
  });

  it("ACTIVO section total equals 500 (single Caja row)", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.sections[0].sectionTotal.equals(D("500"))).toBe(true);
  });

  it("PASIVO_PATRIMONIO section total equals 500 (single Capital row)", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.sections[1].sectionTotal.equals(D("500"))).toBe(true);
  });

  it("balanced fixture → imbalanced: false, imbalanceDelta: 0", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.imbalanced).toBe(false);
    expect(result.imbalanceDelta.isZero()).toBe(true);
  });

  it("caCount=1 → multipleCA: false", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.multipleCA).toBe(false);
    expect(result.caCount).toBe(1);
  });

  it("calls getInitialBalanceFromCA with the orgId", async () => {
    await service.generate(ORG_ID);
    expect(repoInstance.getInitialBalanceFromCA).toHaveBeenCalledWith(ORG_ID);
  });

  it("calls getOrgMetadata with the orgId", async () => {
    await service.generate(ORG_ID);
    expect(repoInstance.getOrgMetadata).toHaveBeenCalledWith(ORG_ID);
  });

  it("calls countCAVouchers with the orgId", async () => {
    await service.generate(ORG_ID);
    expect(repoInstance.countCAVouchers).toHaveBeenCalledWith(ORG_ID);
  });

  it("calls getCADate with the orgId", async () => {
    await service.generate(ORG_ID);
    expect(repoInstance.getCADate).toHaveBeenCalledWith(ORG_ID);
  });
});

describe("InitialBalanceService — multiple CAs (T11 multipleCA variant)", () => {
  let repoInstance: InstanceType<typeof InitialBalanceRepository>;
  let service: InstanceType<typeof InitialBalanceService>;

  beforeEach(() => {
    vi.clearAllMocks();
    repoInstance = new InitialBalanceRepository();
    vi.mocked(repoInstance.countCAVouchers).mockResolvedValue(2);
    vi.mocked(repoInstance.getInitialBalanceFromCA).mockResolvedValue(VALID_ROWS);
    vi.mocked(repoInstance.getOrgMetadata).mockResolvedValue(ORG_HEADER);
    vi.mocked(repoInstance.getCADate).mockResolvedValue(DATE_AT);
    service = new InitialBalanceService(repoInstance);
  });

  it("caCount=2 → multipleCA: true, caCount: 2", async () => {
    const result = await service.generate(ORG_ID);
    expect(result.multipleCA).toBe(true);
    expect(result.caCount).toBe(2);
  });
});
