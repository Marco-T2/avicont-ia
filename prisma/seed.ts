import { seedChartOfAccounts } from "./seeds/chart-of-accounts";
import { seedVoucherTypes } from "./seeds/voucher-types";
import { seedOperationalDocTypes } from "./seeds/operational-doc-types";

async function main() {
  const organizationId = process.argv[2];

  if (!organizationId) {
    console.error("Usage: npx tsx prisma/seed.ts <organizationId>");
    console.error("  Provide the organization ID to seed data for.");
    process.exit(1);
  }

  console.log(`Seeding data for organization: ${organizationId}`);
  await seedChartOfAccounts(organizationId);
  await seedVoucherTypes(organizationId);
  await seedOperationalDocTypes(organizationId);
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
