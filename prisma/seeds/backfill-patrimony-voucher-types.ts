import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { seedVoucherTypes } from "./voucher-types";

type PrismaLike = Pick<PrismaClient, "organization" | "voucherTypeCfg" | "$disconnect">;

interface BackfillResult {
  orgsProcessed: number;
}

export async function backfillPatrimonyVoucherTypes(
  client?: PrismaLike,
): Promise<BackfillResult> {
  const ownsClient = !client;
  const prisma: PrismaLike = client ?? buildDefaultClient();

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      await seedVoucherTypes(org.id, prisma as never);
    }
    return { orgsProcessed: orgs.length };
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

// Allow `npx tsx prisma/seeds/backfill-patrimony-voucher-types.ts`
if (require.main === module) {
  backfillPatrimonyVoucherTypes()
    .then((r) => {
      console.log(`Backfill complete: ${r.orgsProcessed} org(s) processed.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
