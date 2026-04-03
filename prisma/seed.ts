import { seedChartOfAccounts } from "./seeds/chart-of-accounts";

async function main() {
  const organizationId = process.argv[2];

  if (!organizationId) {
    console.error("Usage: npx tsx prisma/seed.ts <organizationId>");
    console.error("  Provide the organization ID to seed the chart of accounts for.");
    process.exit(1);
  }

  console.log(`Seeding chart of accounts for organization: ${organizationId}`);
  await seedChartOfAccounts(organizationId);
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
