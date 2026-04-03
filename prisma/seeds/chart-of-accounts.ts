import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccountType } from "../../generated/prisma/client";

interface AccountDef {
  code: string;
  name: string;
  type: AccountType;
  level: number;
  parentCode: string | null;
}

const accounts: AccountDef[] = [
  // 1 ACTIVO
  { code: "1", name: "ACTIVO", type: AccountType.ACTIVO, level: 1, parentCode: null },
  { code: "1.1", name: "Activo Corriente", type: AccountType.ACTIVO, level: 2, parentCode: "1" },
  { code: "1.1.1", name: "Caja", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.2", name: "Caja Chica", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.3", name: "Bancos", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.4", name: "Cuentas por Cobrar", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.5", name: "Documentos por Cobrar", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.6", name: "Inventario de Mercaderías", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.7", name: "Anticipos a Proveedores", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.1.8", name: "Crédito Fiscal IVA", type: AccountType.ACTIVO, level: 3, parentCode: "1.1" },
  { code: "1.2", name: "Activo No Corriente", type: AccountType.ACTIVO, level: 2, parentCode: "1" },
  { code: "1.2.1", name: "Terrenos", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },
  { code: "1.2.2", name: "Edificios", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },
  { code: "1.2.3", name: "Muebles y Enseres", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },
  { code: "1.2.4", name: "Equipos de Computación", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },
  { code: "1.2.5", name: "Vehículos", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },
  { code: "1.2.6", name: "Depreciación Acumulada", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },
  { code: "1.2.7", name: "Activos Biológicos", type: AccountType.ACTIVO, level: 3, parentCode: "1.2" },

  // 2 PASIVO
  { code: "2", name: "PASIVO", type: AccountType.PASIVO, level: 1, parentCode: null },
  { code: "2.1", name: "Pasivo Corriente", type: AccountType.PASIVO, level: 2, parentCode: "2" },
  { code: "2.1.1", name: "Cuentas por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.2", name: "Documentos por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.3", name: "Sueldos por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.4", name: "Aportes por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.5", name: "Impuestos por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.6", name: "Débito Fiscal IVA", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.7", name: "IT por Pagar", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.1.8", name: "Anticipos de Clientes", type: AccountType.PASIVO, level: 3, parentCode: "2.1" },
  { code: "2.2", name: "Pasivo No Corriente", type: AccountType.PASIVO, level: 2, parentCode: "2" },
  { code: "2.2.1", name: "Préstamos Bancarios a Largo Plazo", type: AccountType.PASIVO, level: 3, parentCode: "2.2" },
  { code: "2.2.2", name: "Obligaciones a Largo Plazo", type: AccountType.PASIVO, level: 3, parentCode: "2.2" },

  // 3 PATRIMONIO
  { code: "3", name: "PATRIMONIO", type: AccountType.PATRIMONIO, level: 1, parentCode: null },
  { code: "3.1", name: "Capital Social", type: AccountType.PATRIMONIO, level: 2, parentCode: "3" },
  { code: "3.1.1", name: "Aportes de los Socios", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.1" },
  { code: "3.1.2", name: "Donaciones Recibidas", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.1" },
  { code: "3.2", name: "Resultados", type: AccountType.PATRIMONIO, level: 2, parentCode: "3" },
  { code: "3.2.1", name: "Resultados Acumulados", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.2" },
  { code: "3.2.2", name: "Resultado de la Gestión", type: AccountType.PATRIMONIO, level: 3, parentCode: "3.2" },

  // 4 INGRESOS
  { code: "4", name: "INGRESOS", type: AccountType.INGRESO, level: 1, parentCode: null },
  { code: "4.1", name: "Ingresos Operativos", type: AccountType.INGRESO, level: 2, parentCode: "4" },
  { code: "4.1.1", name: "Venta de Pollo en Pie", type: AccountType.INGRESO, level: 3, parentCode: "4.1" },
  { code: "4.1.2", name: "Venta de Pollo Faenado", type: AccountType.INGRESO, level: 3, parentCode: "4.1" },
  { code: "4.1.3", name: "Venta de Subproductos", type: AccountType.INGRESO, level: 3, parentCode: "4.1" },
  { code: "4.1.4", name: "Servicios de Flete", type: AccountType.INGRESO, level: 3, parentCode: "4.1" },
  { code: "4.1.5", name: "Cuotas de Socios", type: AccountType.INGRESO, level: 3, parentCode: "4.1" },
  { code: "4.2", name: "Otros Ingresos", type: AccountType.INGRESO, level: 2, parentCode: "4" },
  { code: "4.2.1", name: "Intereses Ganados", type: AccountType.INGRESO, level: 3, parentCode: "4.2" },
  { code: "4.2.2", name: "Ingresos Diversos", type: AccountType.INGRESO, level: 3, parentCode: "4.2" },

  // 5 GASTOS
  { code: "5", name: "GASTOS", type: AccountType.GASTO, level: 1, parentCode: null },
  { code: "5.1", name: "Gastos Operativos", type: AccountType.GASTO, level: 2, parentCode: "5" },
  { code: "5.1.1", name: "Compra de Pollo", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.2", name: "Alimento Balanceado", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.3", name: "Medicamentos y Vacunas", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.4", name: "Servicios Veterinarios", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.5", name: "Chala (Cáscara de Arroz)", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.6", name: "Agua", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.7", name: "Gas (Garrafas)", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.8", name: "Mano de Obra (Galponeros)", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.9", name: "Fletes y Transporte", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.1.10", name: "Mantenimiento de Galpones", type: AccountType.GASTO, level: 3, parentCode: "5.1" },
  { code: "5.2", name: "Gastos Administrativos", type: AccountType.GASTO, level: 2, parentCode: "5" },
  { code: "5.2.1", name: "Sueldos y Salarios", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.2.2", name: "Beneficios Sociales", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.2.3", name: "Alquiler de Oficina", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.2.4", name: "Servicios Básicos", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.2.5", name: "Material de Escritorio", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.2.6", name: "Depreciación", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.2.7", name: "Seguros", type: AccountType.GASTO, level: 3, parentCode: "5.2" },
  { code: "5.3", name: "Gastos Financieros", type: AccountType.GASTO, level: 2, parentCode: "5" },
  { code: "5.3.1", name: "Intereses Bancarios", type: AccountType.GASTO, level: 3, parentCode: "5.3" },
  { code: "5.3.2", name: "Comisiones Bancarias", type: AccountType.GASTO, level: 3, parentCode: "5.3" },
  { code: "5.3.3", name: "IT (Impuesto a las Transacciones)", type: AccountType.GASTO, level: 3, parentCode: "5.3" },
];

/**
 * Seeds the Bolivian chart of accounts (plan de cuentas) for a given organization.
 * Idempotent: skips accounts that already exist (matched by organizationId + code).
 */
export async function seedChartOfAccounts(organizationId: string): Promise<void> {
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Check which accounts already exist for this org
    const existing = await prisma.account.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((a) => a.code));

    // Build a map of code -> db id for parent resolution
    const codeToId = new Map<string, string>();

    // Populate with existing accounts
    if (existing.length > 0) {
      const existingFull = await prisma.account.findMany({
        where: { organizationId },
        select: { code: true, id: true },
      });
      for (const acc of existingFull) {
        codeToId.set(acc.code, acc.id);
      }
    }

    // Insert accounts in order (parents before children, guaranteed by array order)
    for (const acct of accounts) {
      if (existingCodes.has(acct.code)) {
        continue;
      }

      const parentId = acct.parentCode ? codeToId.get(acct.parentCode) ?? null : null;

      const created = await prisma.account.create({
        data: {
          code: acct.code,
          name: acct.name,
          type: acct.type,
          level: acct.level,
          parentId,
          organizationId,
          isActive: true,
        },
      });

      codeToId.set(acct.code, created.id);
    }

    const newCount = accounts.length - existingCodes.size;
    console.log(
      `[seed] Chart of accounts for org ${organizationId}: ${newCount} created, ${existingCodes.size} already existed.`
    );
  } finally {
    await prisma.$disconnect();
  }
}
