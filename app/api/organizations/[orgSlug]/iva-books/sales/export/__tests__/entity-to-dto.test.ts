import { describe, expect, it } from "vitest";

import { TASA_IVA } from "@/features/accounting/iva-books";
import { Prisma } from "@/generated/prisma/client";
import { computeIvaTotals } from "@/modules/iva-books/domain/compute-iva-totals";
import { IvaSalesBookEntry } from "@/modules/iva-books/domain/iva-sales-book-entry.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { entityToDto, entriesToDto } from "../entity-to-dto";

/**
 * Unit tests para mapper hex domain entity → legacy DTO (POC #11.0c A4-c
 * C2 GREEN P3 sub-locks Marco). Cubren las 4 conversion types distintas
 * (per-row identity + Date→string + MonetaryAmount→Decimal + tasaIva
 * injection) + batch wrapper preservation order. 3 tests ocultarían 2
 * conversion types — 5 cumple full coverage P3 lock decision Marco.
 */

function makeFixture(overrides: Partial<{
  saleId: string | null;
  notes: string | null;
  fechaFactura: Date;
  importeTotal: number;
  exentos: number;
}> = {}): IvaSalesBookEntry {
  const inputs = {
    importeTotal: MonetaryAmount.of(overrides.importeTotal ?? 113),
    importeIce: MonetaryAmount.zero(),
    importeIehd: MonetaryAmount.zero(),
    importeIpj: MonetaryAmount.zero(),
    tasas: MonetaryAmount.zero(),
    otrosNoSujetos: MonetaryAmount.zero(),
    exentos: MonetaryAmount.of(overrides.exentos ?? 0),
    tasaCero: MonetaryAmount.zero(),
    codigoDescuentoAdicional: MonetaryAmount.zero(),
    importeGiftCard: MonetaryAmount.zero(),
  };
  const calcResult = computeIvaTotals(inputs);
  const entry = IvaSalesBookEntry.create({
    organizationId: "org-test",
    fiscalPeriodId: "period-test",
    saleId: overrides.saleId === null ? undefined : overrides.saleId ?? "sale-test",
    fechaFactura: overrides.fechaFactura ?? new Date("2099-03-15T12:00:00Z"),
    nitCliente: "1234567",
    razonSocial: "Test Customer",
    numeroFactura: "F-001",
    codigoAutorizacion: "AUTH-001",
    codigoControl: "CTRL-001",
    estadoSIN: "V",
    notes: overrides.notes !== undefined ? overrides.notes : null,
    inputs,
    calcResult,
  });
  return entry;
}

describe("entity-to-dto sales mapper — POC #11.0c A4-c C2 GREEN P3 lockeada", () => {
  it("per-row identity: preserves 30 fields shape mapping (id, status, fechaFactura, nitCliente, razonSocial, estadoSIN, etc.)", () => {
    const entry = makeFixture();
    const dto = entityToDto(entry);

    expect(dto.id).toBe(entry.id);
    expect(dto.organizationId).toBe(entry.organizationId);
    expect(dto.fiscalPeriodId).toBe(entry.fiscalPeriodId);
    expect(dto.nitCliente).toBe(entry.nitCliente);
    expect(dto.razonSocial).toBe(entry.razonSocial);
    expect(dto.numeroFactura).toBe(entry.numeroFactura);
    expect(dto.codigoAutorizacion).toBe(entry.codigoAutorizacion);
    expect(dto.codigoControl).toBe(entry.codigoControl);
    expect(dto.estadoSIN).toBe(entry.estadoSIN);
    expect(dto.status).toBe(entry.status);
    expect(dto.createdAt).toBe(entry.createdAt);
    expect(dto.updatedAt).toBe(entry.updatedAt);
  });

  it("Date → ISO YYYY-MM-DD string conversion (fechaFactura)", () => {
    const entry = makeFixture({
      fechaFactura: new Date("2099-03-15T12:30:45Z"),
    });
    const dto = entityToDto(entry);

    expect(typeof dto.fechaFactura).toBe("string");
    expect(dto.fechaFactura).toBe("2099-03-15");
    expect(dto.fechaFactura).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("MonetaryAmount → Prisma.Decimal conversion preserves value (10 inputs + 4 calcResult derivados)", () => {
    const entry = makeFixture({ importeTotal: 113, exentos: 15.5 });
    const dto = entityToDto(entry);

    // 10 inputs MonetaryAmount.value → Prisma.Decimal
    expect(dto.importeTotal).toBeInstanceOf(Prisma.Decimal);
    expect(dto.importeTotal.toNumber()).toBe(113);
    expect(dto.exentos).toBeInstanceOf(Prisma.Decimal);
    expect(dto.exentos.toNumber()).toBe(15.5);
    expect(dto.importeIce.toNumber()).toBe(0);
    expect(dto.tasaCero.toNumber()).toBe(0);

    // 4 calcResult derivados — subtotal/baseIvaSujetoCf/dfCfIva/dfIva
    expect(dto.subtotal).toBeInstanceOf(Prisma.Decimal);
    expect(dto.baseIvaSujetoCf).toBeInstanceOf(Prisma.Decimal);
    expect(dto.dfCfIva).toBeInstanceOf(Prisma.Decimal);
    expect(dto.dfIva).toBeInstanceOf(Prisma.Decimal);

    // Renames lockeada P3: baseImponible→baseIvaSujetoCf,
    // ivaAmount→{dfCfIva, dfIva}. Verificación dfIva === dfCfIva
    // (ambos provienen de ivaAmount source).
    expect(dto.dfIva.equals(dto.dfCfIva)).toBe(true);
  });

  it("tasaIva injection imports legacy TASA_IVA constant (P3.4 lock — single source of truth)", () => {
    const entry = makeFixture();
    const dto = entityToDto(entry);

    expect(dto.tasaIva).toBeInstanceOf(Prisma.Decimal);
    expect(dto.tasaIva.equals(TASA_IVA)).toBe(true);
    expect(dto.tasaIva.toNumber()).toBe(0.13);
  });

  it("batch wrapper entriesToDto preserves order + applies entityToDto per-row + saleId/notes null→undefined coalesce", () => {
    const entry1 = makeFixture({
      saleId: null,
      notes: null,
      importeTotal: 100,
    });
    const entry2 = makeFixture({
      saleId: "sale-explicit",
      notes: "patch notes",
      importeTotal: 200,
    });
    const entry3 = makeFixture({ importeTotal: 300 });

    const dtos = entriesToDto([entry1, entry2, entry3]);

    expect(dtos).toHaveLength(3);

    // Order preservation
    expect(dtos[0].id).toBe(entry1.id);
    expect(dtos[1].id).toBe(entry2.id);
    expect(dtos[2].id).toBe(entry3.id);

    // null → undefined coalesce (string|null → string?)
    expect(dtos[0].saleId).toBeUndefined();
    expect(dtos[0].notes).toBeUndefined();
    expect(dtos[1].saleId).toBe("sale-explicit");
    expect(dtos[1].notes).toBe("patch notes");

    // Per-row entityToDto applied
    expect(dtos[0].importeTotal.toNumber()).toBe(100);
    expect(dtos[1].importeTotal.toNumber()).toBe(200);
    expect(dtos[2].importeTotal.toNumber()).toBe(300);
  });
});
