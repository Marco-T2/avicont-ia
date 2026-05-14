/**
 * sync-org.ts — Sincroniza manualmente una org de Clerk a la base.
 *
 * Replica lo que hace OrganizationsService.syncOrganization(): crea la org,
 * agrega al usuario como owner, y siembra voucher types + plan de cuentas
 * (4 niveles) + roles del sistema.
 *
 * Útil cuando la org se creó en el dashboard de Clerk (sin pasar por el
 * formulario de la app, que es el único camino que sincroniza). Idempotente.
 *
 * Uso: pnpm exec tsx scripts/sync-org.ts <clerkOrgId> <name> <slug> <clerkUserId>
 */
import { prisma } from "@/lib/prisma";
import { seedChartOfAccounts } from "../prisma/seeds/chart-of-accounts";
import { seedVoucherTypes } from "../prisma/seeds/voucher-types";
import { seedOrgSystemRoles } from "../prisma/seed-system-roles";

async function main() {
  const [clerkOrgId, name, slug, clerkUserId] = process.argv.slice(2);
  if (!clerkOrgId || !name || !slug || !clerkUserId) {
    console.error(
      "Uso: pnpm exec tsx scripts/sync-org.ts <clerkOrgId> <name> <slug> <clerkUserId>",
    );
    process.exit(1);
  }

  const existing = await prisma.organization.findUnique({
    where: { clerkOrgId },
  });
  if (existing) {
    console.log(`Org ${clerkOrgId} ya existe (id=${existing.id}). Nada que hacer.`);
    return;
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) {
    console.error(`Usuario ${clerkUserId} no existe en la base.`);
    process.exit(1);
  }

  const org = await prisma.organization.create({
    data: { clerkOrgId, name, slug },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: "owner" },
  });
  console.log(`Org creada: ${org.id} — ${org.name} (owner: ${user.email})`);

  await seedVoucherTypes(org.id);
  await seedChartOfAccounts(org.id);
  await seedOrgSystemRoles(org.id);
  console.log("Seeds OK: voucher types + plan de cuentas (4 niveles) + roles del sistema.");

  console.log(`\norgId interno: ${org.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
