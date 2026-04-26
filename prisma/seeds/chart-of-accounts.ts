import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccountType, AccountNature, AccountSubtype } from "../../generated/prisma/client";

export interface AccountDef {
  code: string;
  name: string;
  type: AccountType;
  level: number;
  parentCode: string | null;
  isDetail: boolean;
  requiresContact: boolean;
  /** Subtipo contable NIIF/PCGA. Null solo en cuentas raíz de nivel 1. */
  subtype: AccountSubtype | null;
  /**
   * Marca si esta cuenta es una cuenta reguladora (contra-cuenta).
   * Cuando isContraAccount=true, la naturaleza es la OPUESTA al tipo por defecto.
   * Ejemplo: ACTIVO + isContraAccount=true → nature=ACREEDORA (Depreciación Acumulada).
   */
  isContraAccount?: boolean;
}

export function deriveNature(type: AccountType, isContraAccount = false): AccountNature {
  const defaultNature = type === AccountType.ACTIVO || type === AccountType.GASTO
    ? AccountNature.DEUDORA
    : AccountNature.ACREEDORA;
  if (!isContraAccount) return defaultNature;
  return defaultNature === AccountNature.DEUDORA ? AccountNature.ACREEDORA : AccountNature.DEUDORA;
}

/**
 * Plan de cuentas boliviano (PCGA/NIIF).
 * Exportado para testabilidad (los tests pueden inspeccionar el array directamente).
 */
export const ACCOUNTS: AccountDef[] = [
  // ── 1 ACTIVO ──────────────────────────────────────────────────────────────
  { code: "1", name: "ACTIVO", type: AccountType.ACTIVO, level: 1, parentCode: null, isDetail: false, requiresContact: false, subtype: null },
  // Nivel 2: Activo Corriente
  { code: "1.1", name: "Activo Corriente", type: AccountType.ACTIVO, level: 2, parentCode: "1", isDetail: false, requiresContact: false, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.1", name: "Caja", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.2", name: "Caja Chica", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.3", name: "Bancos", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.4", name: "Cuentas por Cobrar", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: true, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.5", name: "Documentos por Cobrar", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: true, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.6", name: "Inventario de Mercaderías", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.7", name: "Anticipos a Proveedores", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: true, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  { code: "1.1.8", name: "Crédito Fiscal IVA", type: AccountType.ACTIVO, level: 3, parentCode: "1.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_CORRIENTE },
  // Nivel 2: Activo No Corriente
  { code: "1.2", name: "Activo No Corriente", type: AccountType.ACTIVO, level: 2, parentCode: "1", isDetail: false, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  { code: "1.2.1", name: "Terrenos", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  { code: "1.2.2", name: "Edificios", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  { code: "1.2.3", name: "Muebles y Enseres", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  { code: "1.2.4", name: "Equipos de Computación", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  { code: "1.2.5", name: "Vehículos", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  // Contra-cuenta: reduce el Activo No Corriente (nature=ACREEDORA por ser contra ACTIVO)
  { code: "1.2.6", name: "Depreciación Acumulada", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE, isContraAccount: true },
  { code: "1.2.7", name: "Activos Biológicos", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE },
  // Contra-cuenta: reduce activos intangibles (amortización acumulada de intangibles)
  { code: "1.2.8", name: "Amortización Acumulada", type: AccountType.ACTIVO, level: 3, parentCode: "1.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.ACTIVO_NO_CORRIENTE, isContraAccount: true },

  // ── 2 PASIVO ──────────────────────────────────────────────────────────────
  { code: "2", name: "PASIVO", type: AccountType.PASIVO, level: 1, parentCode: null, isDetail: false, requiresContact: false, subtype: null },
  // Nivel 2: Pasivo Corriente
  { code: "2.1", name: "Pasivo Corriente", type: AccountType.PASIVO, level: 2, parentCode: "2", isDetail: false, requiresContact: false, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.1", name: "Cuentas por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: true, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.2", name: "Documentos por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: true, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.3", name: "Sueldos por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.4", name: "Aportes por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.5", name: "Impuestos por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.6", name: "Débito Fiscal IVA", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.7", name: "IT por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_CORRIENTE },
  { code: "2.1.8", name: "Anticipos de Clientes", type: AccountType.PASIVO, level: 3, parentCode: "2.1", isDetail: true, requiresContact: true, subtype: AccountSubtype.PASIVO_CORRIENTE },
  // Nivel 2: Pasivo No Corriente
  { code: "2.2", name: "Pasivo No Corriente", type: AccountType.PASIVO, level: 2, parentCode: "2", isDetail: false, requiresContact: false, subtype: AccountSubtype.PASIVO_NO_CORRIENTE },
  { code: "2.2.1", name: "Préstamos Bancarios a Largo Plazo", type: AccountType.PASIVO, level: 3, parentCode: "2.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_NO_CORRIENTE },
  { code: "2.2.2", name: "Obligaciones a Largo Plazo", type: AccountType.PASIVO, level: 3, parentCode: "2.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.PASIVO_NO_CORRIENTE },

  // ── 3 PATRIMONIO ──────────────────────────────────────────────────────────
  { code: "3", name: "PATRIMONIO", type: AccountType.PATRIMONIO, level: 1, parentCode: null, isDetail: false, requiresContact: false, subtype: null },
  // Nivel 2: Capital Social
  { code: "3.1", name: "Capital Social", type: AccountType.PATRIMONIO, level: 2, parentCode: "3", isDetail: false, requiresContact: false, subtype: AccountSubtype.PATRIMONIO_CAPITAL },
  { code: "3.1.1", name: "Aportes de los Socios", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PATRIMONIO_CAPITAL },
  { code: "3.1.2", name: "Donaciones Recibidas", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.PATRIMONIO_CAPITAL },
  // Nivel 2: Resultados
  { code: "3.2", name: "Resultados", type: AccountType.PATRIMONIO, level: 2, parentCode: "3", isDetail: false, requiresContact: false, subtype: AccountSubtype.PATRIMONIO_RESULTADOS },
  { code: "3.2.1", name: "Resultados Acumulados", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.PATRIMONIO_RESULTADOS },
  { code: "3.2.2", name: "Resultado de la Gestión", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.PATRIMONIO_RESULTADOS },

  // ── 4 INGRESOS ────────────────────────────────────────────────────────────
  { code: "4", name: "INGRESOS", type: AccountType.INGRESO, level: 1, parentCode: null, isDetail: false, requiresContact: false, subtype: null },
  // Nivel 2: Ingresos Operativos
  { code: "4.1", name: "Ingresos Operativos", type: AccountType.INGRESO, level: 2, parentCode: "4", isDetail: false, requiresContact: false, subtype: AccountSubtype.INGRESO_OPERATIVO },
  { code: "4.1.1", name: "Venta de Pollo en Pie", type: AccountType.INGRESO, level: 3, parentCode: "4.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_OPERATIVO },
  { code: "4.1.2", name: "Venta de Pollo Faenado", type: AccountType.INGRESO, level: 3, parentCode: "4.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_OPERATIVO },
  { code: "4.1.3", name: "Venta de Subproductos", type: AccountType.INGRESO, level: 3, parentCode: "4.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_OPERATIVO },
  { code: "4.1.4", name: "Servicios de Flete", type: AccountType.INGRESO, level: 3, parentCode: "4.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_OPERATIVO },
  { code: "4.1.5", name: "Cuotas de Socios", type: AccountType.INGRESO, level: 3, parentCode: "4.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_OPERATIVO },
  // Nivel 2: Otros Ingresos
  { code: "4.2", name: "Otros Ingresos", type: AccountType.INGRESO, level: 2, parentCode: "4", isDetail: false, requiresContact: false, subtype: AccountSubtype.INGRESO_NO_OPERATIVO },
  { code: "4.2.1", name: "Intereses Ganados", type: AccountType.INGRESO, level: 3, parentCode: "4.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_NO_OPERATIVO },
  { code: "4.2.2", name: "Ingresos Diversos", type: AccountType.INGRESO, level: 3, parentCode: "4.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.INGRESO_NO_OPERATIVO },

  // ── 5 GASTOS ──────────────────────────────────────────────────────────────
  { code: "5", name: "GASTOS", type: AccountType.GASTO, level: 1, parentCode: null, isDetail: false, requiresContact: false, subtype: null },
  // Nivel 2: Gastos Operativos
  { code: "5.1", name: "Gastos Operativos", type: AccountType.GASTO, level: 2, parentCode: "5", isDetail: false, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.1", name: "Compra de Pollo", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.2", name: "Alimento Balanceado", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.3", name: "Medicamentos y Vacunas", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.4", name: "Servicios Veterinarios", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.5", name: "Chala (Cáscara de Arroz)", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.6", name: "Agua", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.7", name: "Gas (Garrafas)", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.8", name: "Mano de Obra (Galponeros)", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.9", name: "Fletes y Transporte", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  { code: "5.1.10", name: "Mantenimiento de Galpones", type: AccountType.GASTO, level: 3, parentCode: "5.1", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_OPERATIVO },
  // Nivel 2: Gastos Administrativos
  { code: "5.2", name: "Gastos Administrativos", type: AccountType.GASTO, level: 2, parentCode: "5", isDetail: false, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.1", name: "Sueldos y Salarios", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.2", name: "Beneficios Sociales", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.3", name: "Alquiler de Oficina", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.4", name: "Servicios Básicos", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.5", name: "Material de Escritorio", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.6", name: "Depreciación", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  { code: "5.2.7", name: "Seguros", type: AccountType.GASTO, level: 3, parentCode: "5.2", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_ADMINISTRATIVO },
  // Nivel 2: Gastos Financieros
  { code: "5.3", name: "Gastos Financieros", type: AccountType.GASTO, level: 2, parentCode: "5", isDetail: false, requiresContact: false, subtype: AccountSubtype.GASTO_FINANCIERO },
  { code: "5.3.1", name: "Intereses Bancarios", type: AccountType.GASTO, level: 3, parentCode: "5.3", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_FINANCIERO },
  { code: "5.3.2", name: "Comisiones Bancarias", type: AccountType.GASTO, level: 3, parentCode: "5.3", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_FINANCIERO },
  { code: "5.3.3", name: "IT (Impuesto a las Transacciones)", type: AccountType.GASTO, level: 3, parentCode: "5.3", isDetail: true, requiresContact: false, subtype: AccountSubtype.GASTO_FINANCIERO },
];

type PrismaLike = Pick<PrismaClient, "account" | "$disconnect">;

/**
 * Sembrar el plan de cuentas para una organización (uso CLI / scripts).
 * Idempotente por construcción: cada cuenta se upsertea sobre la unique
 * compuesta {organizationId, code}. Acepta un Prisma client opcional para
 * tests; si no se inyecta, instancia uno propio con PrismaPg.
 *
 * En el flujo de creación de organización (transaccional) se usa
 * `AccountsService.seedChartOfAccounts` — esta función standalone existe
 * solo para reseed manual desde `prisma/seed.ts`.
 */
export async function seedChartOfAccounts(
  organizationId: string,
  client?: PrismaLike,
): Promise<void> {
  const ownsClient = !client;
  const prisma: PrismaLike = client ?? buildDefaultClient();

  try {
    const codeToId = new Map<string, string>();

    for (const acct of ACCOUNTS) {
      const parentId = acct.parentCode
        ? codeToId.get(acct.parentCode) ?? null
        : null;
      const isContraAccount = acct.isContraAccount ?? false;
      const nature = deriveNature(acct.type, isContraAccount);

      const created = await prisma.account.upsert({
        where: {
          organizationId_code: { organizationId, code: acct.code },
        },
        create: {
          code: acct.code,
          name: acct.name,
          type: acct.type,
          nature,
          subtype: acct.subtype,
          level: acct.level,
          isDetail: acct.isDetail,
          requiresContact: acct.requiresContact,
          parentId,
          organizationId,
          isActive: true,
          isContraAccount,
        },
        update: {},
      });

      codeToId.set(acct.code, created.id);
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
