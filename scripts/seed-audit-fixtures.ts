/**
 * Seedea fixtures mínimas en una org existente para que el módulo de auditoría
 * tenga eventos visibles en la UI.
 *
 * Uso: npx tsx scripts/seed-audit-fixtures.ts <orgSlug>
 *
 * Pre-requisitos:
 *   - Org creada via flujo Clerk (tiene un member owner real)
 *   - Plan de cuentas seedeado (npx tsx prisma/seed.ts <orgId>)
 *   - voucherTypes pre-existentes (vienen del webhook syncOrganization)
 *
 * Crea:
 *   - 1 fiscal period del mes en curso (si no existe)
 *   - 2 contactos (1 cliente + 1 proveedor)
 *   - 1 sale + 1 sale_detail (con setAuditContext) → genera audit_logs CREATE
 *   - UPDATE del sale → otra row UPDATE
 *   - 1 purchase + 1 purchase_detail → audit_logs CREATE
 *
 * Resultado esperado: ≥5 rows en audit_logs, agrupadas en 2 grupos
 * (1 sale con 3 events + 1 purchase con 2 events).
 *
 * Read-only sobre data existente (busca; no modifica accounts/voucherTypes).
 */
import { prisma } from "@/lib/prisma";
import { setAuditContext } from "@/features/shared/audit-context";

async function main() {
  const orgSlug = process.argv[2];
  if (!orgSlug) {
    console.error("Uso: npx tsx scripts/seed-audit-fixtures.ts <orgSlug>");
    process.exit(1);
  }

  // 1. Resolver org + member owner
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      members: {
        where: { role: { in: ["owner", "admin"] }, deactivatedAt: null },
        include: { user: { select: { id: true, email: true } } },
        take: 1,
      },
    },
  });
  if (!org) {
    console.error(`Org "${orgSlug}" no encontrada.`);
    process.exit(1);
  }
  if (org.members.length === 0) {
    console.error(`Org "${orgSlug}" no tiene members owner/admin activos.`);
    process.exit(1);
  }
  const userId = org.members[0].user.id;
  console.log(`Org: ${org.slug} (id=${org.id})`);
  console.log(`User: ${org.members[0].user.email} (id=${userId})`);

  // 2. Voucher types (sales + purchases)
  const voucherTypes = await prisma.voucherTypeCfg.findMany({
    where: { organizationId: org.id },
    select: { id: true, code: true, name: true },
  });
  console.log(`Voucher types existentes: ${voucherTypes.length}`);
  if (voucherTypes.length === 0) {
    console.error("No hay voucher types. Re-creá la org via webhook.");
    process.exit(1);
  }

  // 3. Cuentas: una de ingreso (4xx) y una de gasto (5xx). isDetail=true son
  // las hojas postables del plan.
  const accounts = await prisma.account.findMany({
    where: { organizationId: org.id, isDetail: true },
    select: { id: true, code: true, name: true, type: true },
  });
  const ingresoAccount = accounts.find(
    (a) => a.type === "INGRESO" || a.code.startsWith("4"),
  );
  const gastoAccount = accounts.find(
    (a) => a.type === "GASTO" || a.code.startsWith("5"),
  );
  if (!ingresoAccount) {
    console.error(
      "No se encontró cuenta de ingreso (4xx). Corré: npx tsx prisma/seed.ts " +
        org.id,
    );
    process.exit(1);
  }
  if (!gastoAccount) {
    console.error(
      "No se encontró cuenta de gasto (5xx). Corré: npx tsx prisma/seed.ts " +
        org.id,
    );
    process.exit(1);
  }
  console.log(`Cuenta ingreso: ${ingresoAccount.code} ${ingresoAccount.name}`);
  console.log(`Cuenta gasto:   ${gastoAccount.code} ${gastoAccount.name}`);

  // 4. Fiscal period del mes en curso (crear si falta)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  let period = await prisma.fiscalPeriod.findFirst({
    where: { organizationId: org.id, year, month },
  });
  if (!period) {
    period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: org.id,
        name: `${monthName(month)} ${year}`,
        year,
        month,
        startDate: new Date(year, month - 1, 1, 12, 0, 0),
        endDate: new Date(year, month, 0, 12, 0, 0),
        status: "OPEN",
        createdById: userId,
      },
    });
    console.log(`Período creado: ${period.name}`);
  } else {
    console.log(`Período existente: ${period.name} (${period.status})`);
  }

  // 5. Contactos: cliente + proveedor
  const stamp = Date.now();
  const cliente = await prisma.contact.create({
    data: {
      organizationId: org.id,
      type: "CLIENTE",
      name: `Cliente Demo ${stamp}`,
      nit: `1000${stamp.toString().slice(-6)}`,
    },
  });
  const proveedor = await prisma.contact.create({
    data: {
      organizationId: org.id,
      type: "PROVEEDOR",
      name: `Proveedor Demo ${stamp}`,
      nit: `2000${stamp.toString().slice(-6)}`,
    },
  });
  console.log(`Contactos creados: cliente=${cliente.id}, proveedor=${proveedor.id}`);

  // 6. Sale + SaleDetail (transacción con setAuditContext → audit_logs)
  const saleSeqMax = await prisma.sale.aggregate({
    where: { organizationId: org.id },
    _max: { sequenceNumber: true },
  });
  const saleSeq = (saleSeqMax._max.sequenceNumber ?? 0) + 1;

  const sale = await prisma.$transaction(async (tx) => {
    await setAuditContext(tx, userId, org.id);
    const created = await tx.sale.create({
      data: {
        organizationId: org.id,
        status: "POSTED",
        sequenceNumber: saleSeq,
        date: new Date(year, month - 1, 5, 12, 0, 0),
        contactId: cliente.id,
        periodId: period.id,
        description: "Venta demo de auditoría",
        totalAmount: "1500.00",
        createdById: userId,
        details: {
          create: [
            {
              description: "Producto demo",
              lineAmount: "1500.00",
              quantity: "10",
              unitPrice: "150.00",
              incomeAccountId: ingresoAccount.id,
              order: 0,
            },
          ],
        },
      },
    });
    return created;
  });
  console.log(`Sale creado: id=${sale.id} (sequence ${saleSeq})`);

  // 7. UPDATE del sale (cambia description, no status) → audit row UPDATE
  await prisma.$transaction(async (tx) => {
    await setAuditContext(tx, userId, org.id);
    await tx.sale.update({
      where: { id: sale.id },
      data: { description: "Venta demo de auditoría — corregida" },
    });
  });
  console.log(`Sale actualizado (description)`);

  // 8. Purchase + PurchaseDetail
  const purchaseSeqMax = await prisma.purchase.aggregate({
    where: { organizationId: org.id, purchaseType: "COMPRA_GENERAL" },
    _max: { sequenceNumber: true },
  });
  const purchaseSeq = (purchaseSeqMax._max.sequenceNumber ?? 0) + 1;

  const purchase = await prisma.$transaction(async (tx) => {
    await setAuditContext(tx, userId, org.id);
    return tx.purchase.create({
      data: {
        organizationId: org.id,
        purchaseType: "COMPRA_GENERAL",
        status: "POSTED",
        sequenceNumber: purchaseSeq,
        date: new Date(year, month - 1, 6, 12, 0, 0),
        contactId: proveedor.id,
        periodId: period.id,
        description: "Compra demo de auditoría",
        totalAmount: "800.00",
        createdById: userId,
        details: {
          create: [
            {
              description: "Insumo demo",
              lineAmount: "800.00",
              quantity: "4",
              unitPrice: "200.00",
              expenseAccountId: gastoAccount.id,
              order: 0,
            },
          ],
        },
      },
    });
  });
  console.log(`Purchase creado: id=${purchase.id} (sequence ${purchaseSeq})`);

  // 9. Reportar audit_logs
  const totalAuditRows = await prisma.auditLog.count({
    where: { organizationId: org.id },
  });
  const byEntityType = await prisma.auditLog.groupBy({
    by: ["entityType", "action"],
    where: { organizationId: org.id },
    _count: true,
  });

  console.log(`\n═══ audit_logs en org ${org.slug} ═══`);
  console.log(`Total rows: ${totalAuditRows}`);
  for (const row of byEntityType) {
    console.log(`  ${row.entityType} / ${row.action}: ${row._count}`);
  }

  console.log(
    `\n✅ Listo. Visitá: http://localhost:3000/${org.slug}/audit`,
  );
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
function monthName(m: number): string {
  return MONTH_NAMES[m - 1];
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Error:", e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
