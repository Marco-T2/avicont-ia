import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type {
  JournalEntry,
  Account,
  Contact,
  VoucherTypeCfg,
  OrgProfile,
  JournalLine,
} from "@/generated/prisma/client";
import { buildVoucherPdfInput } from "@/features/accounting/exporters/voucher-pdf.composer";
import type { DocumentSignatureConfigView } from "@/features/document-signature-config/document-signature-config.types";
import type { JournalEntryWithLines } from "@/features/accounting/journal.types";

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Fixture helpers ──

function makeAccount(code: string, name: string): Account {
  return {
    id: `acc-${code}`,
    code,
    name,
    type: "ASSET",
    nature: "DEUDORA",
    subtype: null,
    parentId: null,
    level: 3,
    isDetail: true,
    requiresContact: false,
    description: null,
    isActive: true,
    organizationId: "org-1",
  } as Account;
}

function makeLine(args: {
  id: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  description?: string;
}): JournalLine & { account: Account; contact: Contact | null } {
  return {
    id: args.id,
    journalEntryId: "entry-1",
    accountId: `acc-${args.accountCode}`,
    debit: D(args.debit),
    credit: D(args.credit),
    description: args.description ?? "",
    contactId: null,
    order: 0,
    account: makeAccount(args.accountCode, args.accountName),
    contact: null,
  } as JournalLine & { account: Account; contact: Contact | null };
}

function makeVoucherType(code: string, prefix: string, name: string): VoucherTypeCfg {
  return {
    id: `vt-${code}`,
    organizationId: "org-1",
    code,
    prefix,
    name,
    description: null,
    isActive: true,
  } as VoucherTypeCfg;
}

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntryWithLines {
  return {
    id: "entry-1",
    number: 145,
    referenceNumber: 9951,
    date: new Date("2025-08-19T12:00:00Z"),
    description: "A rendir ECR Jhody Gutierrez",
    status: "DRAFT",
    periodId: "period-1",
    voucherTypeId: "vt-CE",
    contactId: null,
    sourceType: null,
    sourceId: null,
    organizationId: "org-1",
    createdById: "user-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    lines: [
      makeLine({ id: "l1", accountCode: "1010.011.031", accountName: "ECR-JHODY GUTIERREZ", debit: "3760.00", credit: "0.00" }),
      makeLine({ id: "l2", accountCode: "1000.003.003", accountName: "BANCO MERCANTIL SCZ M/NAL CTA.CTE.", debit: "0.00", credit: "3760.00" }),
    ],
    contact: null,
    voucherType: makeVoucherType("CE", "CE", "EGRESO"),
  };
}

const PROFILE: OrgProfile = {
  id: "p-1",
  organizationId: "org-1",
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

// ── Tests ──

describe("buildVoucherPdfInput", () => {
  it("mapea OrgProfile al bloque organization", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.organization.name).toBe("DEKMA");
    expect(input.organization.address).toContain("Avenida Arica");
    expect(input.organization.address).toContain("La Paz");
    expect(input.organization.logoDataUrl).toBeUndefined();
  });

  it("pasa logoDataUrl cuando fue provisto", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, "data:image/png;base64,AAAA", {});

    expect(input.organization.logoDataUrl).toBe("data:image/png;base64,AAAA");
  });

  it("organization queda con strings vacíos cuando profile es null", () => {
    const input = buildVoucherPdfInput(makeEntry(), null, SIG_CONFIG, undefined, {});

    expect(input.organization.name).toBe("");
    expect(input.organization.address).toBe("");
  });

  it("formatea el número de comprobante con prefix-padded-number", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.number).toBe("CE-0145");
  });

  it("formatea la fecha como DD/MM/YY", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.date).toBe("19/08/25");
  });

  it("copia voucherType.name como type (EGRESO) y description como glosa", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.type).toBe("EGRESO");
    expect(input.voucher.glosa).toBe("A rendir ECR Jhody Gutierrez");
  });

  it("reference viene de referenceNumber (string) o vacío", () => {
    const withRef = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});
    const withoutRef = buildVoucherPdfInput(makeEntry({ referenceNumber: null }), PROFILE, SIG_CONFIG, undefined, {});

    expect(withRef.voucher.reference).toBe("9951");
    expect(withoutRef.voucher.reference).toBe("");
  });

  it("exchangeRate y ufvRate vienen de opts", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {
      exchangeRate: 6.96,
      ufvRate: "2.82242",
    });

    expect(input.voucher.exchangeRate).toBe("6.96");
    expect(input.voucher.ufvRate).toBe("2.82242");
  });

  it("convierte Decimals de las lines a strings con 2 decimales", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.entries).toHaveLength(2);
    expect(input.entries[0].debitBs).toBe("3760.00");
    expect(input.entries[0].creditBs).toBe("0.00");
    expect(input.entries[1].debitBs).toBe("0.00");
    expect(input.entries[1].creditBs).toBe("3760.00");
  });

  it("calcula USD = round(Bs / exchangeRate, 2) cuando rate > 0", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {
      exchangeRate: 6.96,
    });

    expect(input.entries[0].debitUsd).toBe("540.23");
    expect(input.entries[0].creditUsd).toBe("0.00");
    expect(input.entries[1].creditUsd).toBe("540.23");
  });

  it("omite USD (cadena vacía) cuando exchangeRate es 0 o ausente", () => {
    const withZero = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, { exchangeRate: 0 });
    const withoutRate = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(withZero.entries[0].debitUsd).toBe("");
    expect(withZero.totals.debitUsd).toBe("");
    expect(withoutRate.entries[0].debitUsd).toBe("");
    expect(withoutRate.totals.debitUsd).toBe("");
  });

  it("totales suman las lines con tolerancia exacta (2 decimales)", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, { exchangeRate: 6.96 });

    expect(input.totals.debitBs).toBe("3760.00");
    expect(input.totals.creditBs).toBe("3760.00");
    expect(input.totals.debitUsd).toBe("540.23");
    expect(input.totals.creditUsd).toBe("540.23");
  });

  it("amountLiteral == amountToWordsEs(total debit Bs)", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.amountLiteral).toBe("TRES MIL SETECIENTOS SESENTA 00/100 BS");
  });

  it("signatures preserva el orden de labels y mapea VISTO_BUENO → V°B°", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    const keys = Object.keys(input.signatures);
    expect(keys).toEqual(["elaborado", "aprobado", "vistoBueno"]);
    expect(input.signatures.elaborado.label).toBe("ELABORADO");
    expect(input.signatures.aprobado.label).toBe("APROBADO");
    expect(input.signatures.vistoBueno.label).toBe("V°B°");
  });

  it("signatures vacío cuando sigConfig.labels es []", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, { documentType: "COMPROBANTE", labels: [], showReceiverRow: false }, undefined, {});

    expect(Object.keys(input.signatures)).toHaveLength(0);
  });

  it("footer está presente con labels fijas cuando showReceiverRow = true", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.footer).toBeDefined();
    expect(input.footer!.nombreApellido.label).toBe("Nombre y Apellido");
    expect(input.footer!.ci.label).toBe("C.I.");
    expect(input.footer!.firma.label).toBe("Firma");
    expect(input.footer!.nombreApellido.value).toBeUndefined();
  });

  it("footer es undefined cuando showReceiverRow = false", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, { ...SIG_CONFIG, showReceiverRow: false }, undefined, {});

    expect(input.footer).toBeUndefined();
  });

  it("payTo viene de entry.contact?.name", () => {
    const contact = { id: "c-1", organizationId: "org-1", name: "Jhody Michael Gutierrez", type: "CUSTOMER" } as Contact;
    const entry = { ...makeEntry(), contact, contactId: "c-1" };

    const input = buildVoucherPdfInput(entry, PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.payTo).toBe("Jhody Michael Gutierrez");
  });

  it("payTo es cadena vacía cuando no hay contact", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.payTo).toBe("");
  });

  it("bank deriva del primer line con credit > 0 (típico EGRESO)", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.bank).toBe("BANCO MERCANTIL SCZ M/NAL CTA.CTE.");
  });

  it("internalId viene del id de la entry", () => {
    const input = buildVoucherPdfInput(makeEntry(), PROFILE, SIG_CONFIG, undefined, {});

    expect(input.voucher.internalId).toBe("entry-1");
  });
});
