/**
 * T6 — JournalService.exportVoucherPdf
 *
 * Integración: repo + profile service + sig config service + composer + exporter.
 * Todas las deps externas mockeadas — no DB, no fetch real.
 */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { JournalService } from "@/features/accounting/journal.service";
import { NotFoundError } from "@/features/shared/errors";
import type { JournalRepository } from "@/features/accounting/journal.repository";
import type { OrgProfileService } from "@/features/org-profile/server";
import type { DocumentSignatureConfigService } from "@/features/document-signature-config/server";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { JournalEntryWithLines } from "@/features/accounting/journal.types";
import type { OrgProfile, FiscalPeriod } from "@/generated/prisma/client";
import type { DocumentSignatureConfigView } from "@/features/document-signature-config/document-signature-config.types";

const ORG_ID = "org-pdf";
const ENTRY_ID = "entry-pdf-1";

const D = (v: string) => new Prisma.Decimal(v);

function makeEntry(): JournalEntryWithLines {
  return {
    id: ENTRY_ID,
    number: 145,
    referenceNumber: 9951,
    date: new Date("2025-08-19T12:00:00Z"),
    description: "A rendir ECR Jhody",
    status: "DRAFT",
    periodId: "period-1",
    voucherTypeId: "vt-CE",
    contactId: null,
    sourceType: null,
    sourceId: null,
    organizationId: ORG_ID,
    createdById: "user-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    voucherType: {
      id: "vt-CE",
      organizationId: ORG_ID,
      code: "CE",
      prefix: "CE",
      name: "EGRESO",
      description: null,
      isActive: true,
    },
    contact: null,
    lines: [
      {
        id: "l1",
        journalEntryId: ENTRY_ID,
        accountId: "acc-A",
        debit: D("3760.00"),
        credit: D("0.00"),
        description: "linea debito",
        contactId: null,
        order: 0,
        account: {
          id: "acc-A",
          code: "1010.011.031",
          name: "ECR-JHODY GUTIERREZ",
          type: "ASSET",
          nature: "DEUDORA",
          subtype: null,
          parentId: null,
          level: 3,
          isDetail: true,
          requiresContact: false,
          description: null,
          isActive: true,
          organizationId: ORG_ID,
        },
        contact: null,
      },
      {
        id: "l2",
        journalEntryId: ENTRY_ID,
        accountId: "acc-B",
        debit: D("0.00"),
        credit: D("3760.00"),
        description: "linea credito",
        contactId: null,
        order: 1,
        account: {
          id: "acc-B",
          code: "1000.003.003",
          name: "BANCO MERCANTIL",
          type: "ASSET",
          nature: "DEUDORA",
          subtype: null,
          parentId: null,
          level: 3,
          isDetail: true,
          requiresContact: false,
          description: null,
          isActive: true,
          organizationId: ORG_ID,
        },
        contact: null,
      },
    ],
  } as unknown as JournalEntryWithLines;
}

const PROFILE: OrgProfile = {
  id: "p-1",
  organizationId: ORG_ID,
  razonSocial: "DEKMA",
  nit: "1234567890",
  direccion: "Avenida Arica Nro. 100",
  ciudad: "La Paz",
  telefono: "2-111111",
  nroPatronal: null,
  logoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SIG_CONFIG: DocumentSignatureConfigView = {
  documentType: "COMPROBANTE",
  labels: ["ELABORADO", "APROBADO", "VISTO_BUENO"],
  showReceiverRow: true,
};

const PERIOD: FiscalPeriod = {
  id: "period-1",
  organizationId: ORG_ID,
  name: "2025-26",
  year: 2025,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
  status: "OPEN",
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildService(opts?: {
  entry?: JournalEntryWithLines | null;
  profile?: OrgProfile;
  sigConfig?: DocumentSignatureConfigView;
  period?: FiscalPeriod;
}) {
  const entry = opts?.entry === undefined ? makeEntry() : opts.entry;

  const mockRepo = {
    findById: vi.fn().mockResolvedValue(entry),
  } as unknown as JournalRepository;

  const mockOrgProfileService = {
    getOrCreate: vi.fn().mockResolvedValue(opts?.profile ?? PROFILE),
  } as unknown as OrgProfileService;

  const mockSigConfigService = {
    getOrDefault: vi.fn().mockResolvedValue(opts?.sigConfig ?? SIG_CONFIG),
  } as unknown as DocumentSignatureConfigService;

  const mockPeriodsService = {
    getById: vi.fn().mockResolvedValue(opts?.period ?? PERIOD),
  } as unknown as FiscalPeriodsService;

  const service = new JournalService(
    mockRepo,
    undefined, // accountsRepo
    undefined, // balancesService
    mockPeriodsService,
    undefined, // voucherTypesService
    undefined, // contactsService
    mockOrgProfileService,
    mockSigConfigService,
  );

  return { service, mockRepo, mockOrgProfileService, mockSigConfigService, mockPeriodsService };
}

describe("JournalService.exportVoucherPdf", () => {
  it("retorna Buffer no vacío que empieza con %PDF-", async () => {
    const { service } = buildService();

    const buffer = await service.exportVoucherPdf(ORG_ID, ENTRY_ID, { exchangeRate: 6.96 });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5 * 1024);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("lanza NotFoundError cuando el asiento no existe", async () => {
    const { service } = buildService({ entry: null });

    await expect(
      service.exportVoucherPdf(ORG_ID, "no-existe", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("llama getOrDefault con documentType COMPROBANTE", async () => {
    const { service, mockSigConfigService } = buildService();

    await service.exportVoucherPdf(ORG_ID, ENTRY_ID, {});

    expect(mockSigConfigService.getOrDefault).toHaveBeenCalledWith(ORG_ID, "COMPROBANTE");
  });

  it("renderiza sin logo cuando profile.logoUrl es null", async () => {
    const { service } = buildService();

    const buffer = await service.exportVoucherPdf(ORG_ID, ENTRY_ID, {});

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("acepta opts vacíos (sin exchangeRate / ufvRate)", async () => {
    const { service } = buildService();

    const buffer = await service.exportVoucherPdf(ORG_ID, ENTRY_ID, {});

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
