import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, VoucherTypeCode } from "../../generated/prisma/client";

interface VoucherTypeDef {
  code: VoucherTypeCode;
  name: string;
  description: string;
}

const defaultTypes: VoucherTypeDef[] = [
  { code: VoucherTypeCode.CI, name: "Comprobante de Ingreso", description: "Registra entrada de dinero (cobros, ventas)" },
  { code: VoucherTypeCode.CE, name: "Comprobante de Egreso", description: "Registra salida de dinero (pagos, compras)" },
  { code: VoucherTypeCode.CD, name: "Comprobante de Diario", description: "Registra ajustes, depreciaciones, provisiones" },
  { code: VoucherTypeCode.CT, name: "Comprobante de Traspaso", description: "Registra movimientos entre cuentas propias" },
  { code: VoucherTypeCode.CA, name: "Comprobante de Apertura", description: "Registra asiento de apertura del periodo" },
];

/**
 * Seeds the 5 default voucher types for a given organization.
 * Idempotent: skips types that already exist (matched by organizationId + code).
 */
export async function seedVoucherTypes(organizationId: string): Promise<void> {
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.voucherTypeCfg.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((vt) => vt.code));

    let created = 0;
    for (const vt of defaultTypes) {
      if (existingCodes.has(vt.code)) continue;

      await prisma.voucherTypeCfg.create({
        data: {
          code: vt.code,
          name: vt.name,
          description: vt.description,
          organizationId,
        },
      });
      created++;
    }

    console.log(
      `[seed] Voucher types for org ${organizationId}: ${created} created, ${existingCodes.size} already existed.`
    );
  } finally {
    await prisma.$disconnect();
  }
}
