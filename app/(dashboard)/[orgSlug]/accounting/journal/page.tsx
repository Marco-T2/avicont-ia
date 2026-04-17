import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { JournalService } from "@/features/accounting";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { VoucherTypesService } from "@/features/voucher-types";
import JournalEntryList from "@/components/accounting/journal-entry-list";

interface JournalPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function JournalPage({
  params,
  searchParams,
}: JournalPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  const journalService = new JournalService();
  const periodsService = new FiscalPeriodsService();
  const voucherTypesService = new VoucherTypesService();

  const filters: Record<string, unknown> = {};
  if (sp.periodId && typeof sp.periodId === "string") {
    filters.periodId = sp.periodId;
  }
  if (sp.voucherTypeId && typeof sp.voucherTypeId === "string") {
    filters.voucherTypeId = sp.voucherTypeId;
  }
  if (sp.status && typeof sp.status === "string") {
    filters.status = sp.status;
  }
  if (
    sp.origin &&
    typeof sp.origin === "string" &&
    (sp.origin === "manual" || sp.origin === "auto")
  ) {
    filters.origin = sp.origin;
  }

  const [entries, periods, voucherTypes] = await Promise.all([
    journalService.list(orgId, filters),
    periodsService.list(orgId),
    voucherTypesService.list(orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Diario</h1>
        <p className="text-gray-500 mt-1">Registro de asientos contables</p>
      </div>

      <JournalEntryList
        orgSlug={orgSlug}
        entries={JSON.parse(JSON.stringify(entries))}
        periods={JSON.parse(JSON.stringify(periods))}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
        filters={{
          periodId: typeof sp.periodId === "string" ? sp.periodId : undefined,
          voucherTypeId:
            typeof sp.voucherTypeId === "string" ? sp.voucherTypeId : undefined,
          status: typeof sp.status === "string" ? sp.status : undefined,
          origin:
            sp.origin === "manual" || sp.origin === "auto"
              ? (sp.origin as "manual" | "auto")
              : undefined,
        }}
      />
    </div>
  );
}
