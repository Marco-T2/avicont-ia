import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export interface VoucherTypeSeed {
  code: string;
  prefix: string;
  name: string;
  description: string;
}

export const DEFAULT_VOUCHER_TYPES: readonly VoucherTypeSeed[] = [
  { code: "CI", prefix: "I", name: "Comprobante de Ingreso",     description: "Registra entrada de dinero (cobros, ventas)" },
  { code: "CE", prefix: "E", name: "Comprobante de Egreso",      description: "Registra salida de dinero (pagos, compras)" },
  { code: "CD", prefix: "D", name: "Comprobante de Diario",      description: "Registra ajustes, depreciaciones, provisiones" },
  { code: "CT", prefix: "T", name: "Comprobante de Traspaso",    description: "Registra movimientos entre cuentas propias" },
  { code: "CA", prefix: "A", name: "Comprobante de Apertura",    description: "Registra asiento de apertura del periodo" },
  { code: "CN", prefix: "N", name: "Comprobante de Nómina",      description: "Registra salarios, aguinaldos y cargas sociales" },
  { code: "CM", prefix: "M", name: "Comprobante de Depreciación", description: "Registra depreciación y amortización de activos" },
  { code: "CB", prefix: "B", name: "Comprobante Bancario",       description: "Registra movimientos bancarios no operativos" },
] as const;

type PrismaLike = Pick<PrismaClient, "voucherTypeCfg" | "$disconnect">;

/**
 * Seeds the 8 default voucher types for a given organization.
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
