import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { Button } from "@/components/ui/button";
import { TrialBalancePageClient } from "@/components/accounting/trial-balance-page-client";

interface TrialBalancePageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function TrialBalancePage({ params }: TrialBalancePageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/informes`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Informes
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Balance de Comprobación</h1>
        <p className="text-muted-foreground mt-1">
          Balance de Comprobación de Sumas y Saldos — Todos los tipos de asiento
        </p>
      </div>

      <TrialBalancePageClient orgSlug={orgSlug} />
    </div>
  );
}
