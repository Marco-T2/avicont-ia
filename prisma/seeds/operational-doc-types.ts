import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

/**
 * Canonical OperationalDocType catalog seeded per organization for the
 * journal-physical-document change.
 *
 * Codes are UI/PDF abbreviations (NOT SIN fiscal codes — those are scoped to
 * a future fiscal-codes change). Direction reuses the extended enum from
 * Phase 1: VENTA, COMPRA, DESPACHO joined COBRO, PAGO, BOTH.
 *
 * Idempotency strategy is `findFirst + skip` (NOT upsert) per spec I-4:
 * existing rows with the same (orgId, code) — e.g. an RC the org created
 * via the admin UI before this change — MUST NOT be mutated. The seed is
 * purely additive.
 */
interface OperationalDocTypeSeedRow {
  code: string;
  name: string;
  direction: "VENTA" | "DESPACHO" | "COMPRA" | "COBRO" | "PAGO";
}

export const DEFAULT_OPERATIONAL_DOC_TYPES: readonly OperationalDocTypeSeedRow[] = [
  { code: "VG", name: "Venta de Gestión",      direction: "VENTA"    },
  { code: "ND", name: "Nota de Despacho",      direction: "DESPACHO" },
  { code: "BC", name: "Boleta Cerrada",        direction: "DESPACHO" },
  { code: "FL", name: "Flete",                 direction: "COMPRA"   },
  { code: "PF", name: "Pollo Faenado",         direction: "COMPRA"   },
  { code: "CG", name: "Compra General",        direction: "COMPRA"   },
  { code: "SV", name: "Servicio",              direction: "COMPRA"   },
  { code: "RC", name: "Recibo de Cobranza",    direction: "COBRO"    },
  { code: "RI", name: "Recibo de Ingreso",     direction: "COBRO"    },
  { code: "RE", name: "Recibo de Egreso",      direction: "PAGO"     },
] as const;

type PrismaLike = Pick<PrismaClient, "operationalDocType" | "$disconnect">;

/**
 * Seeds the 10 canonical OperationalDocType rows for a given organization.
 *
 * For each entry, `findFirst({ where: { organizationId, code } })` decides
 * whether to create — if a row exists we leave it untouched (name/direction/
 * isActive preserved per I-4). Accepts an optional Prisma client so tests can
 * inject a mock; defaults to the standard pg-adapter Prisma client otherwise.
 */
export async function seedOperationalDocTypes(
  organizationId: string,
  client?: PrismaLike,
): Promise<void> {
  const ownsClient = !client;
  const prisma: PrismaLike = client ?? buildDefaultClient();

  try {
    for (const entry of DEFAULT_OPERATIONAL_DOC_TYPES) {
      const existing = await prisma.operationalDocType.findFirst({
        where: { organizationId, code: entry.code },
      });
      if (existing) continue;
      await prisma.operationalDocType.create({
        data: {
          organizationId,
          code: entry.code,
          name: entry.name,
          direction: entry.direction,
          isActive: true,
        },
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
