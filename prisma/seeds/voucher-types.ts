import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export interface VoucherTypeSeed {
  code: string;
  prefix: string;
  name: string;
  description: string;
  isAdjustment: boolean;
}

export const DEFAULT_VOUCHER_TYPES: readonly VoucherTypeSeed[] = [
  { code: "CI", prefix: "I", name: "Comprobante de Ingreso",      description: "Registra entrada de dinero (cobros, ventas)",                                                     isAdjustment: false },
  { code: "CE", prefix: "E", name: "Comprobante de Egreso",       description: "Registra salida de dinero (pagos, compras)",                                                      isAdjustment: false },
  { code: "CD", prefix: "D", name: "Comprobante de Diario",       description: "Registra movimientos contables generales que no son ingresos, egresos ni traspasos",              isAdjustment: false },
  { code: "CJ", prefix: "J", name: "Comprobante de Ajuste",       description: "Registra ajustes de cierre, depreciaciones, provisiones y correcciones contables",                isAdjustment: true  },
  { code: "CT", prefix: "T", name: "Comprobante de Traspaso",     description: "Registra movimientos entre cuentas propias",                                                      isAdjustment: false },
  { code: "CA", prefix: "A", name: "Comprobante de Apertura",     description: "Registra asiento de apertura del periodo",                                                        isAdjustment: false },
  { code: "CN", prefix: "N", name: "Comprobante de Nómina",       description: "Registra salarios, aguinaldos y cargas sociales",                                                 isAdjustment: false },
  { code: "CM", prefix: "M", name: "Comprobante de Depreciación", description: "Registra depreciación y amortización de activos",                                                 isAdjustment: false },
  { code: "CB", prefix: "B", name: "Comprobante Bancario",        description: "Registra movimientos bancarios no operativos",                                                    isAdjustment: false },
] as const;

type PrismaLike = Pick<PrismaClient, "voucherTypeCfg" | "$disconnect">;

/**
 * Seeds the default voucher types for a given organization.
 * Idempotent by construction: every entry is upserted on {organizationId, code}.
 * Accepts an optional Prisma client so tests can inject a mock.
 */
export async function seedVoucherTypes(
  organizationId: string,
  client?: PrismaLike,
): Promise<void> {
  const ownsClient = !client;
  const prisma: PrismaLike = client ?? buildDefaultClient();

  try {
    for (const vt of DEFAULT_VOUCHER_TYPES) {
      await prisma.voucherTypeCfg.upsert({
        where: { organizationId_code: { organizationId, code: vt.code } },
        create: {
          organizationId,
          code: vt.code,
          prefix: vt.prefix,
          name: vt.name,
          description: vt.description,
          isAdjustment: vt.isAdjustment,
        },
        update: {},
      });
    }
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

function buildDefaultClient(): PrismaLike {
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
